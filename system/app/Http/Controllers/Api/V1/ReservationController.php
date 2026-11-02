<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertReservationRequest;
use App\Models\Reservation;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    use ApiResponse;

    private const ACTIVE_STATUSES = ['pending', 'confirmed', 'arrived', 'seated'];

    private const ALL_STATUSES = ['pending', 'confirmed', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:'.implode(',', self::ALL_STATUSES)],
            'reservation_date' => ['nullable', 'date'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'restaurant_table_id' => ['nullable', 'integer', 'exists:restaurant_tables,id'],
            'sort' => ['nullable', 'in:reservation_date,reservation_time,guest_name,status,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'reservation_date';
        $direction = $request->string('direction')->value() ?: 'desc';

        $reservations = Reservation::query()
            ->with([
                'customer:id,name,phone,customer_code',
                'table:id,name,table_number,area_id',
                'area:id,name',
            ])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('guest_name', 'like', $search)
                    ->orWhere('phone', 'like', $search));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('reservation_date'), fn ($query) => $query->whereDate('reservation_date', $request->string('reservation_date')->value()))
            ->when($request->filled('area_id'), fn ($query) => $query->where('area_id', $request->integer('area_id')))
            ->when($request->filled('restaurant_table_id'), fn ($query) => $query->where('restaurant_table_id', $request->integer('restaurant_table_id')))
            ->orderBy($sort, $direction)
            ->orderBy('reservation_time')
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Reservations retrieved.', $reservations);
    }

    public function store(UpsertReservationRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $data['status'] = $data['status'] ?? 'pending';
        $data['created_by'] = $request->user()?->id;

        $this->assertNoTableConflict($data);

        $reservation = DB::transaction(function () use ($request, $activityLogger, $data): Reservation {
            $reservation = Reservation::query()->create($data);
            $activityLogger->log($request, 'reservation.created', 'tables', $reservation, after: $reservation->toArray());

            return $reservation;
        });

        return $this->success(
            'Reservation created.',
            $reservation->load(['customer:id,name,phone,customer_code', 'table:id,name,table_number', 'area:id,name']),
            201
        );
    }

    public function show(Reservation $reservation): JsonResponse
    {
        return $this->success(
            'Reservation retrieved.',
            $reservation->load(['customer:id,name,phone,customer_code', 'table:id,name,table_number', 'area:id,name', 'creator:id,name'])
        );
    }

    public function update(UpsertReservationRequest $request, Reservation $reservation, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $this->assertNoTableConflict($data, $reservation->id);

        $before = $reservation->toArray();
        DB::transaction(function () use ($request, $reservation, $activityLogger, $before, $data): void {
            $reservation->update($data);
            $activityLogger->log($request, 'reservation.updated', 'tables', $reservation, $before, $reservation->fresh()->toArray());
        });

        return $this->success(
            'Reservation updated.',
            $reservation->fresh()->load(['customer:id,name,phone,customer_code', 'table:id,name,table_number', 'area:id,name'])
        );
    }

    public function destroy(Request $request, Reservation $reservation, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('tables.reservations')) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        $before = $reservation->toArray();
        DB::transaction(function () use ($request, $reservation, $activityLogger, $before): void {
            $reservation->update(['status' => 'cancelled']);
            $activityLogger->log($request, 'reservation.cancelled', 'tables', $reservation, $before, $reservation->fresh()->toArray());
        });

        return $this->success('Reservation cancelled.', $reservation->fresh());
    }

    public function updateStatus(Request $request, Reservation $reservation, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('tables.reservations')) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:'.implode(',', self::ALL_STATUSES)],
        ]);

        $payload = array_merge($reservation->only([
            'restaurant_table_id',
            'reservation_date',
            'reservation_time',
            'status',
        ]), $validated);

        $this->assertNoTableConflict($payload, $reservation->id);

        $before = $reservation->toArray();
        DB::transaction(function () use ($request, $reservation, $activityLogger, $before, $validated): void {
            $reservation->update(['status' => $validated['status']]);
            $activityLogger->log($request, 'reservation.status_updated', 'tables', $reservation, $before, $reservation->fresh()->toArray());
        });

        return $this->success(
            'Reservation status updated.',
            $reservation->fresh()->load(['customer:id,name,phone,customer_code', 'table:id,name,table_number', 'area:id,name'])
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertNoTableConflict(array $data, ?int $ignoreId = null): void
    {
        $tableId = $data['restaurant_table_id'] ?? null;
        $status = $data['status'] ?? 'pending';

        if (! $tableId || in_array($status, ['cancelled', 'no_show', 'completed'], true)) {
            return;
        }

        $date = Carbon::parse($data['reservation_date'])->toDateString();
        $time = Carbon::parse($data['reservation_time'])->format('H:i:s');
        $target = Carbon::parse($date.' '.$time)->format('Y-m-d H:i:s');

        $conflict = Reservation::query()
            ->where('restaurant_table_id', $tableId)
            ->whereDate('reservation_date', $date)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->whereRaw(
                'ABS(TIMESTAMPDIFF(MINUTE, CONCAT(reservation_date, " ", reservation_time), ?)) <= 90',
                [$target]
            )
            ->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ['This table already has a reservation within ±90 minutes on the selected date.'],
            ]);
        }
    }
}
