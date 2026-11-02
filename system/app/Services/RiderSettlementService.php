<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Rider;
use App\Models\RiderSettlement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Rider COD settlements.
 *
 * A settlement covers one rider and an inclusive date range. total_cod is the sum of cod_amount of the
 * rider's delivered deliveries (by delivered_at) in the range. The rider keeps `commission` and owes the
 * restaurant (total_cod - commission); `paid_to_restaurant` is what has been handed over so far, and
 * balance = total_cod - commission - paid_to_restaurant is still outstanding.
 *
 * Draft / settled settlements for the same rider may not overlap, which also guarantees a delivery is
 * never counted by two settlements.
 */
class RiderSettlementService
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SETTLED = 'settled';

    public const STATUS_CANCELLED = 'cancelled';

    public function __construct(private readonly SettingsService $settings) {}

    /**
     * @param  array{rider_id?: int|string|null, status?: string|null, from?: string|null, to?: string|null, search?: string|null, per_page?: int|string|null}  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $query = RiderSettlement::query()->with(['rider:id,name,phone', 'creator:id,name']);

        if (! empty($filters['rider_id'])) {
            $query->where('rider_id', (int) $filters['rider_id']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        // Settlements whose period overlaps [from, to].
        if (! empty($filters['from'])) {
            $query->whereDate('period_end', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('period_start', '<=', $filters['to']);
        }
        if (! empty($filters['search'])) {
            $query->where('settlement_number', 'like', '%'.$filters['search'].'%');
        }

        return $query->orderByDesc('id')->paginate(min(max((int) ($filters['per_page'] ?? 15), 1), 100));
    }

    public function find(RiderSettlement $settlement): RiderSettlement
    {
        $settlement->load(['rider:id,name,phone,vehicle_number', 'creator:id,name']);

        $deliveries = $this->deliveriesQuery($settlement->rider_id, $settlement->period_start->toDateString(), $settlement->period_end->toDateString())
            ->with('order:id,order_number')
            ->orderBy('delivered_at')
            ->get(['id', 'order_id', 'rider_id', 'cod_amount', 'delivery_charge', 'delivered_at']);

        $settlement->setRelation('deliveries', $deliveries);

        return $settlement;
    }

    /**
     * @return array<string, mixed>
     */
    public function preview(int $riderId, string $periodStart, string $periodEnd): array
    {
        $rider = Rider::query()->withTrashed()->findOrFail($riderId);
        [$start, $end] = $this->normalisePeriod($periodStart, $periodEnd);

        $agg = $this->deliveriesQuery($riderId, $start, $end)
            ->selectRaw('COUNT(*) as deliveries, COALESCE(SUM(cod_amount),0) as total_cod, COALESCE(SUM(delivery_charge),0) as delivery_charge')
            ->first();

        $totalCod = $this->money($agg->total_cod);
        $commission = $this->defaultCommission($totalCod);

        $overlaps = $this->overlapping($riderId, $start, $end)->get(['id', 'settlement_number', 'period_start', 'period_end', 'status']);

        return [
            'rider' => ['id' => $rider->id, 'name' => $rider->name, 'phone' => $rider->phone],
            'period_start' => $start,
            'period_end' => $end,
            'deliveries_count' => (int) $agg->deliveries,
            'total_cod' => $totalCod,
            'delivery_charge' => $this->money($agg->delivery_charge),
            'suggested_commission' => $commission,
            'suggested_paid_to_restaurant' => $this->money($totalCod - $commission),
            'balance' => $this->money($totalCod - $commission),
            'can_create' => $overlaps->isEmpty(),
            'overlapping_settlements' => $overlaps,
        ];
    }

    /**
     * @param  array{rider_id: int, period_start: string, period_end: string, commission?: float|int|string|null, paid_to_restaurant?: float|int|string|null, notes?: string|null}  $payload
     */
    public function create(User $user, array $payload): RiderSettlement
    {
        return DB::transaction(function () use ($user, $payload): RiderSettlement {
            // Serialise concurrent creations for the same rider so the overlap check is race-free.
            $rider = Rider::query()->lockForUpdate()->findOrFail((int) $payload['rider_id']);
            [$start, $end] = $this->normalisePeriod($payload['period_start'], $payload['period_end']);

            if ($clash = $this->overlapping($rider->id, $start, $end)->first()) {
                throw ValidationException::withMessages([
                    'period_start' => ["Overlaps {$clash->status} settlement {$clash->settlement_number} ({$clash->period_start->toDateString()} to {$clash->period_end->toDateString()})."],
                ]);
            }

            $totalCod = $this->money($this->deliveriesQuery($rider->id, $start, $end)->sum('cod_amount'));
            $commission = array_key_exists('commission', $payload) && $payload['commission'] !== null
                ? $this->money($payload['commission'])
                : $this->defaultCommission($totalCod);
            $paid = $this->money($payload['paid_to_restaurant'] ?? 0);

            $this->assertAmounts($totalCod, $commission, $paid);

            $settlement = RiderSettlement::query()->create([
                'rider_id' => $rider->id,
                'settlement_number' => 'TMP-'.Str::uuid(),
                'period_start' => $start,
                'period_end' => $end,
                'total_cod' => $totalCod,
                'commission' => $commission,
                'paid_to_restaurant' => $paid,
                'balance' => $this->money($totalCod - $commission - $paid),
                'status' => self::STATUS_DRAFT,
                'created_by' => $user->id,
                'notes' => $payload['notes'] ?? null,
            ]);

            $settlement->update(['settlement_number' => sprintf('RST-%s-%06d', now()->format('Y'), $settlement->id)]);

            return $settlement->load(['rider:id,name,phone', 'creator:id,name']);
        });
    }

    /**
     * Draft -> settled. Optionally records the amount handed over to the restaurant.
     */
    public function settle(RiderSettlement $settlement, ?float $paidToRestaurant = null): RiderSettlement
    {
        return DB::transaction(function () use ($settlement, $paidToRestaurant): RiderSettlement {
            $locked = RiderSettlement::query()->lockForUpdate()->findOrFail($settlement->id);

            if ($locked->status !== self::STATUS_DRAFT) {
                throw ValidationException::withMessages(['status' => ["Only draft settlements can be settled (current status: {$locked->status})."]]);
            }

            $total = (float) $locked->total_cod;
            $commission = (float) $locked->commission;
            $paid = $paidToRestaurant !== null ? $this->money($paidToRestaurant) : (float) $locked->paid_to_restaurant;

            $this->assertAmounts($total, $commission, $paid);

            $locked->update([
                'paid_to_restaurant' => $paid,
                'balance' => $this->money($total - $commission - $paid),
                'status' => self::STATUS_SETTLED,
                'settled_at' => now(),
            ]);

            return $locked->load(['rider:id,name,phone', 'creator:id,name']);
        });
    }

    /** Only drafts may be cancelled. */
    public function cancel(RiderSettlement $settlement): RiderSettlement
    {
        return DB::transaction(function () use ($settlement): RiderSettlement {
            $locked = RiderSettlement::query()->lockForUpdate()->findOrFail($settlement->id);

            if ($locked->status !== self::STATUS_DRAFT) {
                throw ValidationException::withMessages(['status' => ["Only draft settlements can be cancelled (current status: {$locked->status})."]]);
            }

            $locked->update(['status' => self::STATUS_CANCELLED]);

            return $locked->load(['rider:id,name,phone', 'creator:id,name']);
        });
    }

    // ------------------------------------------------------------------------------------------

    /** Delivered deliveries of the rider whose delivered_at falls in the inclusive date range. */
    private function deliveriesQuery(int $riderId, string $start, string $end): Builder
    {
        return Delivery::query()
            ->where('rider_id', $riderId)
            ->where('status', Delivery::STATUS_DELIVERED)
            ->whereBetween('delivered_at', [
                CarbonImmutable::parse($start)->startOfDay(),
                CarbonImmutable::parse($end)->endOfDay(),
            ]);
    }

    /** Draft / settled settlements for the rider whose period intersects [start, end]. */
    private function overlapping(int $riderId, string $start, string $end): Builder
    {
        return RiderSettlement::query()
            ->where('rider_id', $riderId)
            ->whereIn('status', [self::STATUS_DRAFT, self::STATUS_SETTLED])
            ->whereDate('period_start', '<=', $end)
            ->whereDate('period_end', '>=', $start);
    }

    /** @return array{0: string, 1: string} */
    private function normalisePeriod(string $start, string $end): array
    {
        $s = CarbonImmutable::parse($start)->startOfDay();
        $e = CarbonImmutable::parse($end)->startOfDay();

        if ($e->lessThan($s)) {
            throw ValidationException::withMessages(['period_end' => ['The period end must be on or after the period start.']]);
        }

        return [$s->toDateString(), $e->toDateString()];
    }

    /** Commission suggested from `delivery.rider_commission_percent` (legacy flat key `rider_commission_percent` as fallback), else 0. */
    private function defaultCommission(float $totalCod): float
    {
        $percent = (float) ($this->settings->get('delivery.rider_commission_percent')
            ?? $this->settings->get('rider_commission_percent', 0));

        return $percent > 0 ? $this->money($totalCod * $percent / 100) : 0.0;
    }

    private function assertAmounts(float $totalCod, float $commission, float $paid): void
    {
        if ($commission > $totalCod + 0.004) {
            throw ValidationException::withMessages(['commission' => ['Commission cannot exceed the total COD.']]);
        }
        if ($paid > $totalCod - $commission + 0.004) {
            throw ValidationException::withMessages(['paid_to_restaurant' => ['Paid to restaurant cannot exceed total COD minus commission.']]);
        }
    }

    private function money(mixed $value): float
    {
        return round((float) $value, 2);
    }
}
