<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryService
{
    public const STATUSES = [
        'pending',
        'assigned',
        'picked_up',
        'on_the_way',
        'delivered',
        'failed',
        'cancelled',
    ];

    public const ACTIVE_STATUSES = ['pending', 'assigned', 'picked_up', 'on_the_way'];

    public const TERMINAL_STATUSES = ['delivered', 'failed', 'cancelled'];

    /** @var array<string, list<string>> */
    private const TRANSITIONS = [
        'pending' => ['assigned', 'cancelled'],
        'assigned' => ['picked_up', 'cancelled', 'failed'],
        'picked_up' => ['on_the_way', 'failed', 'cancelled'],
        'on_the_way' => ['delivered', 'failed', 'cancelled'],
        'delivered' => [],
        'failed' => ['pending', 'assigned'],
        'cancelled' => [],
        // legacy migration default
        'awaiting_assignment' => ['assigned', 'cancelled', 'pending'],
    ];

    /**
     * @return Collection<int, Delivery>
     */
    public function activeDeliveries(?int $riderId = null): Collection
    {
        return Delivery::query()
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->when($riderId, fn ($query) => $query->where('rider_id', $riderId))
            ->with($this->defaultRelations())
            ->orderByRaw("FIELD(status, 'on_the_way', 'picked_up', 'assigned', 'pending')")
            ->orderBy('assigned_at')
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);

        return Delivery::query()
            ->with($this->defaultRelations())
            ->when(! empty($filters['status']), fn ($query) => $query->where('status', $filters['status']))
            ->when(! empty($filters['rider_id']), fn ($query) => $query->where('rider_id', $filters['rider_id']))
            ->when(! empty($filters['search']), function ($query) use ($filters): void {
                $search = '%'.$filters['search'].'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('address', 'like', $search)
                        ->orWhere('phone', 'like', $search)
                        ->orWhereHas('order', fn ($order) => $order->where('order_number', 'like', $search))
                        ->orWhereHas('customer', fn ($customer) => $customer
                            ->where('name', 'like', $search)
                            ->orWhere('phone', 'like', $search))
                        ->orWhereHas('rider', fn ($rider) => $rider
                            ->where('name', 'like', $search)
                            ->orWhere('phone', 'like', $search));
                });
            })
            ->when(! empty($filters['date_from']), fn ($query) => $query->whereDate('created_at', '>=', $filters['date_from']))
            ->when(! empty($filters['date_to']), fn ($query) => $query->whereDate('created_at', '<=', $filters['date_to']))
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function findWithRelations(Delivery $delivery): Delivery
    {
        return $delivery->load($this->defaultRelations());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function assignRider(User $user, array $payload): Delivery
    {
        return DB::transaction(function () use ($user, $payload): Delivery {
            $order = Order::query()->lockForUpdate()->findOrFail($payload['order_id']);
            $order->loadMissing('customer');
            $rider = Rider::query()->lockForUpdate()->findOrFail($payload['rider_id']);

            if ($order->order_type !== 'delivery') {
                throw ValidationException::withMessages([
                    'order_id' => ['Only delivery orders can be assigned a rider.'],
                ]);
            }

            if (in_array($order->status, ['cancelled', 'refunded'], true)) {
                throw ValidationException::withMessages([
                    'order_id' => ['Cannot assign a rider to a cancelled or refunded order.'],
                ]);
            }

            if (! $rider->is_active) {
                throw ValidationException::withMessages([
                    'rider_id' => ['Rider is inactive.'],
                ]);
            }

            if ($rider->status === 'offline') {
                throw ValidationException::withMessages([
                    'rider_id' => ['Rider is offline.'],
                ]);
            }

            $delivery = Delivery::query()
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->first();

            if ($delivery && in_array($delivery->status, ['delivered'], true)) {
                throw ValidationException::withMessages([
                    'order_id' => ['This delivery is already completed.'],
                ]);
            }

            if ($delivery && in_array($delivery->status, ['cancelled'], true)) {
                throw ValidationException::withMessages([
                    'order_id' => ['This delivery was cancelled. Create a new delivery order instead.'],
                ]);
            }

            $address = $payload['address']
                ?? $delivery?->address
                ?? $order->delivery_address
                ?? $order->customer?->address;

            $phone = $payload['phone']
                ?? $delivery?->phone
                ?? $order->customer?->phone
                ?? $rider->phone;

            if (blank($address)) {
                throw ValidationException::withMessages([
                    'address' => ['Delivery address is required.'],
                ]);
            }

            if (blank($phone)) {
                throw ValidationException::withMessages([
                    'phone' => ['Delivery phone is required.'],
                ]);
            }

            $previousRiderId = $delivery?->rider_id;

            $attributes = [
                'customer_id' => $order->customer_id,
                'address' => $address,
                'phone' => $phone,
                'rider_id' => $rider->id,
                'delivery_charge' => $payload['delivery_charge']
                    ?? $delivery?->delivery_charge
                    ?? $order->delivery_charge
                    ?? 0,
                'cod_amount' => $payload['cod_amount']
                    ?? $delivery?->cod_amount
                    ?? ($order->payment_status === 'paid' ? 0 : $order->grand_total),
                'status' => 'assigned',
                'assigned_at' => now(),
                'picked_up_at' => null,
                'on_the_way_at' => null,
                'delivered_at' => null,
                'failed_at' => null,
                'failure_reason' => null,
            ];

            if ($delivery) {
                $delivery->update($attributes);
            } else {
                $delivery = Delivery::query()->create(array_merge($attributes, [
                    'order_id' => $order->id,
                ]));
            }

            $rider->update(['status' => 'busy']);

            if ($previousRiderId && $previousRiderId !== $rider->id) {
                $this->refreshRiderAvailability((int) $previousRiderId);
            }

            if (! in_array($order->status, ['out_for_delivery', 'completed'], true)) {
                // Keep kitchen/order flow intact; mark ready→out_for_delivery only after pickup.
            }

            return $this->findWithRelations($delivery->fresh());
        }, 3);
    }

    public function updateStatus(Delivery $delivery, string $status, User $user, ?string $failureReason = null, ?string $notes = null): Delivery
    {
        $status = strtolower($status);

        if (! in_array($status, self::STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Invalid delivery status.'],
            ]);
        }

        return DB::transaction(function () use ($delivery, $status, $user, $failureReason, $notes): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->findOrFail($delivery->id);
            $from = $this->normalizeStatus($delivery->status);

            $this->assertTransitionAllowed($from, $status);

            if ($status === 'failed' && blank($failureReason)) {
                throw ValidationException::withMessages([
                    'failure_reason' => ['Failure reason is required when marking a delivery as failed.'],
                ]);
            }

            if (in_array($status, ['assigned', 'picked_up', 'on_the_way'], true) && ! $delivery->rider_id) {
                throw ValidationException::withMessages([
                    'status' => ['Assign a rider before advancing this delivery.'],
                ]);
            }

            $updates = ['status' => $status];

            match ($status) {
                'pending' => $updates = array_merge($updates, [
                    'rider_id' => null,
                    'assigned_at' => null,
                    'picked_up_at' => null,
                    'on_the_way_at' => null,
                    'delivered_at' => null,
                    'failed_at' => null,
                    'failure_reason' => null,
                ]),
                'assigned' => $updates = array_merge($updates, [
                    'assigned_at' => $delivery->assigned_at ?? now(),
                    'picked_up_at' => null,
                    'on_the_way_at' => null,
                    'delivered_at' => null,
                    'failed_at' => null,
                    'failure_reason' => null,
                ]),
                'picked_up' => $updates['picked_up_at'] = now(),
                'on_the_way' => $updates = array_merge($updates, [
                    'picked_up_at' => $delivery->picked_up_at ?? now(),
                    'on_the_way_at' => now(),
                ]),
                'delivered' => $updates = array_merge($updates, [
                    'picked_up_at' => $delivery->picked_up_at ?? now(),
                    'on_the_way_at' => $delivery->on_the_way_at ?? now(),
                    'delivered_at' => now(),
                    'failed_at' => null,
                    'failure_reason' => null,
                ]),
                'failed' => $updates = array_merge($updates, [
                    'failed_at' => now(),
                    'failure_reason' => $failureReason,
                ]),
                'cancelled' => $updates = array_merge($updates, [
                    'failure_reason' => $failureReason ?? $notes,
                ]),
                default => null,
            };

            $previousRiderId = $delivery->rider_id;
            $delivery->update($updates);

            $order = Order::query()->lockForUpdate()->findOrFail($delivery->order_id);
            $this->syncOrderStatus($order, $status, $user, $notes);

            if ($delivery->rider_id) {
                $this->refreshRiderAvailability((int) $delivery->rider_id);
            } elseif ($previousRiderId) {
                $this->refreshRiderAvailability((int) $previousRiderId);
            }

            return $this->findWithRelations($delivery->fresh());
        }, 3);
    }

    /**
     * Ensure a pending delivery row exists for a delivery order (used by OrderService).
     *
     * @param  array<string, mixed>  $extra
     */
    public function ensurePendingDelivery(Order $order, array $extra = []): ?Delivery
    {
        if ($order->order_type !== 'delivery') {
            return null;
        }

        $existing = Delivery::query()->where('order_id', $order->id)->first();
        if ($existing) {
            return $existing;
        }

        $address = $extra['address'] ?? $order->delivery_address ?? $order->customer?->address;
        $phone = $extra['phone'] ?? $order->customer?->phone;

        if (blank($address) || blank($phone)) {
            return null;
        }

        return Delivery::query()->create([
            'order_id' => $order->id,
            'customer_id' => $order->customer_id,
            'address' => $address,
            'phone' => $phone,
            'delivery_charge' => $order->delivery_charge ?? 0,
            'cod_amount' => $order->payment_status === 'paid' ? 0 : ($order->grand_total ?? 0),
            'status' => 'pending',
        ]);
    }

    private function normalizeStatus(string $status): string
    {
        return $status === 'awaiting_assignment' ? 'pending' : $status;
    }

    private function assertTransitionAllowed(string $from, string $to): void
    {
        if ($from === $to) {
            throw ValidationException::withMessages([
                'status' => ['Delivery is already in this status.'],
            ]);
        }

        $allowed = self::TRANSITIONS[$from] ?? [];
        if (! in_array($to, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change delivery status from {$from} to {$to}."],
            ]);
        }
    }

    private function syncOrderStatus(Order $order, string $deliveryStatus, User $user, ?string $notes): void
    {
        $target = match ($deliveryStatus) {
            'picked_up', 'on_the_way' => 'out_for_delivery',
            'delivered' => 'completed',
            'cancelled' => 'cancelled',
            default => null,
        };

        if ($target === null || $order->status === $target) {
            return;
        }

        if (in_array($order->status, ['cancelled', 'refunded', 'partially_refunded', 'completed'], true)
            && $target !== 'completed') {
            return;
        }

        if ($target === 'cancelled' && ($order->sale()->exists() || $order->payment_status === 'paid')) {
            return;
        }

        $from = $order->status;
        $order->update(['status' => $target]);

        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'from_status' => $from,
            'to_status' => $target,
            'notes' => $notes ?? "Delivery marked {$deliveryStatus}",
        ]);
    }

    private function refreshRiderAvailability(int $riderId): void
    {
        $rider = Rider::query()->lockForUpdate()->find($riderId);
        if (! $rider || ! $rider->is_active) {
            return;
        }

        if ($rider->status === 'offline') {
            return;
        }

        $hasActive = Delivery::query()
            ->where('rider_id', $riderId)
            ->whereIn('status', ['assigned', 'picked_up', 'on_the_way'])
            ->exists();

        $rider->update(['status' => $hasActive ? 'busy' : 'available']);
    }

    /**
     * @return list<string>
     */
    private function defaultRelations(): array
    {
        return [
            'order:id,order_number,order_type,status,payment_status,grand_total,delivery_address,customer_id,created_by,ordered_at',
            'order.customer:id,name,phone',
            'customer:id,name,phone,address',
            'rider:id,name,phone,vehicle_number,status,is_active',
        ];
    }
}
