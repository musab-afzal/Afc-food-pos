<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CouponService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): Coupon
    {
        $data['code'] = $this->normalizeCode($data['code']);
        $data['used_count'] = 0;

        return Coupon::query()->create($data)->fresh();
    }

    /** @param array<string, mixed> $data */
    public function update(Coupon $coupon, array $data): Coupon
    {
        return DB::transaction(function () use ($coupon, $data): Coupon {
            $coupon = Coupon::query()->lockForUpdate()->findOrFail($coupon->id);

            if (isset($data['code'])) {
                $data['code'] = $this->normalizeCode($data['code']);
            }

            $limit = array_key_exists('total_usage_limit', $data) ? $data['total_usage_limit'] : $coupon->total_usage_limit;
            if ($limit !== null && (int) $limit < $coupon->used_count) {
                throw ValidationException::withMessages([
                    'total_usage_limit' => ["The usage limit cannot be lower than the number of times the coupon was already used ({$coupon->used_count})."],
                ]);
            }

            $start = $data['start_date'] ?? $coupon->start_date->toDateString();
            $expiry = $data['expiry_date'] ?? $coupon->expiry_date->toDateString();
            if ($expiry < $start) {
                throw ValidationException::withMessages(['expiry_date' => ['The expiry date must be on or after the start date.']]);
            }

            $coupon->update($data);

            return $coupon->fresh();
        });
    }

    public function delete(Coupon $coupon): void
    {
        DB::transaction(function () use ($coupon): void {
            $coupon = Coupon::query()->lockForUpdate()->findOrFail($coupon->id);

            if ($coupon->usages()->exists()) {
                throw ValidationException::withMessages([
                    'coupon' => ['This coupon has been used and cannot be deleted. Deactivate it instead.'],
                ]);
            }

            $coupon->delete();
        });
    }

    /**
     * Validate a coupon against an order total and (optionally) a customer. Read-only: nothing is consumed.
     *
     * @return array{coupon: Coupon, discount_amount: string, order_total: string, payable_total: string}
     */
    public function validate(string $code, string|float|int $orderTotal, ?int $customerId = null): array
    {
        return DB::transaction(function () use ($code, $orderTotal, $customerId): array {
            $coupon = $this->lockByCode($code);

            return $this->evaluate($coupon, $orderTotal, $customerId);
        });
    }

    /**
     * Validate and consume a coupon (records usage and increments used_count) atomically.
     * Ready to be called by sale/order checkout once coupon application is wired in.
     *
     * @return array{coupon: Coupon, usage: CouponUsage, discount_amount: string, order_total: string, payable_total: string}
     */
    public function redeem(string $code, string|float|int $orderTotal, ?int $customerId = null, ?int $orderId = null, ?int $saleId = null): array
    {
        return DB::transaction(function () use ($code, $orderTotal, $customerId, $orderId, $saleId): array {
            $coupon = $this->lockByCode($code);
            $result = $this->evaluate($coupon, $orderTotal, $customerId);

            $usage = CouponUsage::query()->create([
                'coupon_id' => $coupon->id,
                'customer_id' => $customerId,
                'order_id' => $orderId,
                'sale_id' => $saleId,
                'discount_amount' => $result['discount_amount'],
                'used_at' => now(),
            ]);
            $coupon->increment('used_count');

            return ['coupon' => $coupon->fresh(), 'usage' => $usage] + array_diff_key($result, ['coupon' => true]);
        });
    }

    /** Pure calculation: discount for a given type/value/cap, never exceeding the order total. */
    public function calculateDiscount(string $type, string|float|int $value, string|float|int $orderTotal, string|float|int|null $maxDiscount = null): string
    {
        $totalCents = $this->toCents($orderTotal);

        $discountCents = $type === 'percent'
            ? (int) round($totalCents * ((float) $value / 100))
            : $this->toCents($value);

        if ($maxDiscount !== null && (float) $maxDiscount > 0) {
            $discountCents = min($discountCents, $this->toCents($maxDiscount));
        }

        return $this->fromCents(max(0, min($discountCents, $totalCents)));
    }

    /** @return array{coupon: Coupon, discount_amount: string, order_total: string, payable_total: string} */
    private function evaluate(Coupon $coupon, string|float|int $orderTotal, ?int $customerId): array
    {
        $today = now()->startOfDay();

        if (! $coupon->is_active) {
            $this->fail('This coupon is not active.');
        }
        if ($coupon->start_date->gt($today)) {
            $this->fail('This coupon is not valid yet. It starts on '.$coupon->start_date->toDateString().'.');
        }
        if ($coupon->expiry_date->lt($today)) {
            $this->fail('This coupon has expired.');
        }
        if ($coupon->total_usage_limit !== null && $coupon->used_count >= $coupon->total_usage_limit) {
            $this->fail('This coupon has reached its usage limit.');
        }

        if ($coupon->per_customer_limit !== null) {
            if ($customerId === null) {
                $this->fail('A customer is required to use this coupon.', 'customer_id');
            }
            $used = CouponUsage::query()->where('coupon_id', $coupon->id)->where('customer_id', $customerId)->count();
            if ($used >= $coupon->per_customer_limit) {
                $this->fail('This customer has already used this coupon the maximum number of times.', 'customer_id');
            }
        }

        if ($customerId !== null && ! Customer::query()->whereKey($customerId)->where('is_active', true)->exists()) {
            $this->fail('The selected customer is not available.', 'customer_id');
        }

        if ($this->toCents($orderTotal) < $this->toCents($coupon->min_order)) {
            $this->fail('The order total must be at least '.number_format((float) $coupon->min_order, 2, '.', '').' to use this coupon.', 'order_total');
        }

        $discount = $this->calculateDiscount($coupon->type, $coupon->value, $orderTotal, $coupon->max_discount);
        if ($this->toCents($discount) <= 0) {
            $this->fail('This coupon gives no discount on the current order.', 'order_total');
        }

        return [
            'coupon' => $coupon,
            'discount_amount' => $discount,
            'order_total' => $this->fromCents($this->toCents($orderTotal)),
            'payable_total' => $this->fromCents($this->toCents($orderTotal) - $this->toCents($discount)),
        ];
    }

    private function lockByCode(string $code): Coupon
    {
        $coupon = Coupon::query()->where('code', $this->normalizeCode($code))->lockForUpdate()->first();

        if (! $coupon) {
            $this->fail('This coupon code is not valid.');
        }

        return $coupon;
    }

    private function fail(string $message, string $field = 'code'): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }

    private function normalizeCode(string $code): string
    {
        return strtoupper(trim($code));
    }

    private function toCents(string|float|int $amount): int
    {
        return (int) round(((float) $amount) * 100);
    }

    private function fromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
