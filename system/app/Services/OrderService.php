<?php

namespace App\Services;

use App\Models\Addon;
use App\Models\Delivery;
use App\Models\Dish;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\KitchenTicket;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Refund;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public const CANCEL_WINDOW_HOURS = 24;

    /**
     * Inventory is consumed when the kitchen ticket is created (open orders sent to kitchen).
     *
     * @param  array<string, mixed>  $payload
     */
    public function createOpenOrder(User $user, array $payload): Order
    {
        return DB::transaction(function () use ($user, $payload): Order {
            $built = $this->buildLines($payload, 'pos');
            $now = now();
            $uuid = $payload['uuid'] ?? (string) Str::uuid();

            $order = Order::query()->create([
                'uuid' => $uuid,
                'order_number' => 'PENDING-'.$uuid,
                'customer_id' => $payload['customer_id'] ?? null,
                'restaurant_table_id' => $payload['restaurant_table_id'] ?? null,
                'created_by' => $user->id,
                'source' => $payload['source'] ?? 'pos',
                'order_type' => $payload['order_type'],
                'status' => $payload['status'] ?? 'confirmed',
                'payment_status' => 'unpaid',
                'delivery_address' => $payload['delivery_address'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'subtotal' => $this->money($built['subtotalCents']),
                'discount_total' => $this->money($built['discountCents']),
                'tax_total' => $this->money($built['taxCents']),
                'service_charge' => $this->money($built['serviceChargeCents']),
                'delivery_charge' => $this->money($built['deliveryChargeCents']),
                'grand_total' => $this->money($built['grandTotalCents']),
                'ordered_at' => $now,
            ]);

            $order->update([
                'order_number' => app(SettingsService::class)->formatOrderNumber($order->id),
            ]);

            $orderItemIds = $this->persistOrderItems($order, $built['lines']);

            $this->consumeInventory($user, $built['inventoryConsumption'], "Order {$order->order_number}");
            $this->createKitchenTicket($order, $orderItemIds);

            if (($payload['order_type'] ?? null) === 'dine_in' && ! empty($payload['restaurant_table_id'])) {
                RestaurantTable::query()
                    ->whereKey($payload['restaurant_table_id'])
                    ->update(['status' => 'occupied']);
            }

            if (($payload['order_type'] ?? null) === 'delivery') {
                $this->createPendingDelivery($order, $payload);
            }

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'from_status' => null,
                'to_status' => $order->status,
                'notes' => 'Order created',
            ]);

            return $order->fresh([
                'items.addons',
                'customer',
                'table',
                'creator:id,name',
                'kitchenTickets.items',
                'statusHistory.user:id,name',
                'delivery',
            ]);
        }, 3);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function createPendingDelivery(Order $order, array $payload): void
    {
        $order->loadMissing('customer');

        $address = $payload['delivery_address'] ?? $order->delivery_address ?? $order->customer?->address;
        $phone = $payload['delivery_phone'] ?? $order->customer?->phone;

        if (blank($address) || blank($phone)) {
            return;
        }

        Delivery::query()->create([
            'order_id' => $order->id,
            'customer_id' => $order->customer_id,
            'address' => $address,
            'phone' => $phone,
            'delivery_charge' => $order->delivery_charge ?? 0,
            'cod_amount' => $order->grand_total ?? 0,
            'status' => 'pending',
        ]);
    }

    public function updateStatus(Order $order, string $status, User $user, ?string $notes = null): Order
    {
        $status = strtolower($status);
        $this->assertValidStatus($status);
        $this->assertTransitionAllowed($order->status, $status);

        return DB::transaction(function () use ($order, $status, $user, $notes): Order {
            $from = $order->status;
            $order->update(['status' => $status]);

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'from_status' => $from,
                'to_status' => $status,
                'notes' => $notes,
            ]);

            return $order->fresh(['statusHistory.user:id,name']);
        });
    }

    public function cancel(Order $order, User $user, ?string $reason = null): Order
    {
        if (in_array($order->status, ['cancelled', 'refunded'], true)) {
            throw ValidationException::withMessages(['status' => ['Order is already cancelled or refunded.']]);
        }

        $placedAt = $order->ordered_at ?? $order->created_at;
        if ($placedAt && $placedAt->lt(now()->subHours(self::CANCEL_WINDOW_HOURS))) {
            throw ValidationException::withMessages(['status' => ['Orders can only be cancelled within '.self::CANCEL_WINDOW_HOURS.' hours of being placed.']]);
        }

        return DB::transaction(function () use ($order, $user, $reason): Order {
            // Paid orders: refund whatever is still outstanding on the sale and put the stock back.
            $sale = $order->sale()->first();
            if ($sale && $sale->status !== 'cancelled') {
                $outstanding = (float) $sale->grand_total - (float) Refund::query()->where('sale_id', $sale->id)->sum('amount');
                if ($outstanding > 0.004) {
                    app(RefundService::class)->create($user, [
                        'sale_id' => $sale->id,
                        'reason' => $reason ?: "Order {$order->order_number} cancelled",
                        'restore_inventory' => true,
                    ]);
                }
            }

            $from = $order->refresh()->status;
            $order->update(['status' => 'cancelled']);

            $order->kitchenTickets()
                ->whereNotIn('status', ['completed', 'cancelled'])
                ->update(['status' => 'cancelled']);

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'from_status' => $from,
                'to_status' => 'cancelled',
                'notes' => $reason,
            ]);

            if ($order->order_type === 'dine_in' && $order->restaurant_table_id) {
                RestaurantTable::query()
                    ->whereKey($order->restaurant_table_id)
                    ->update(['status' => 'available']);
            }

            return $order->fresh(['statusHistory.user:id,name', 'table']);
        });
    }

    /**
     * Accept a pending QR guest order: confirm, create kitchen ticket, consume inventory.
     */
    public function acceptQrOrder(Order $order, User $user): Order
    {
        if ($order->source !== 'qr') {
            throw ValidationException::withMessages(['order' => ['Only QR orders can be accepted here.']]);
        }

        if ($order->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending QR orders can be accepted.']]);
        }

        return DB::transaction(function () use ($order, $user): Order {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($order->source !== 'qr' || $order->status !== 'pending') {
                throw ValidationException::withMessages(['status' => ['Only pending QR orders can be accepted.']]);
            }

            if ($order->kitchenTickets()->exists()) {
                throw ValidationException::withMessages(['order' => ['This QR order already has a kitchen ticket.']]);
            }

            $order->load([
                'items.dish.recipe.items.inventoryItem',
                'items.variant.recipe.items.inventoryItem',
            ]);

            $consumption = $this->consumptionFromOrderItems($order);
            $this->consumeInventory($user, $consumption, "Order {$order->order_number}");
            $this->createKitchenTicket($order, $order->items->pluck('id')->all());

            $from = $order->status;
            $order->update(['status' => 'confirmed']);

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'from_status' => $from,
                'to_status' => 'confirmed',
                'notes' => 'QR order accepted',
            ]);

            return $order->fresh([
                'items.addons',
                'customer',
                'table',
                'creator:id,name',
                'kitchenTickets.items',
                'statusHistory.user:id,name',
            ]);
        }, 3);
    }

    /**
     * Build priced lines for POS or QR channel (used by QrOrderService placeOrder).
     *
     * @param  array<string, mixed>  $payload
     * @param  'pos'|'qr'  $channel
     * @return array{
     *     lines: list<array<string, mixed>>,
     *     inventoryConsumption: array<int, float>,
     *     subtotalCents: int,
     *     discountCents: int,
     *     taxCents: int,
     *     serviceChargeCents: int,
     *     deliveryChargeCents: int,
     *     grandTotalCents: int
     * }
     */
    public function quoteLines(array $payload, string $channel = 'pos'): array
    {
        return $this->buildLines($payload, $channel);
    }

    public function moneyFromCents(int $cents): string
    {
        return $this->money($cents);
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     * @return list<int>
     */
    public function persistOrderItems(Order $order, array $lines): array
    {
        $orderItemIds = [];

        foreach ($lines as $line) {
            $orderItem = $order->items()->create([
                'dish_id' => $line['dish']->id,
                'dish_variant_id' => $line['variant']?->id,
                'dish_name' => $line['dish']->name,
                'variant_name' => $line['variant']?->name,
                'quantity' => $line['quantity'],
                'unit_price' => $this->money($line['unitPriceCents']),
                'discount' => $this->money($line['discountCents']),
                'tax' => $this->money($line['lineTaxCents']),
                'total' => $this->money($line['grossCents'] - $line['discountCents'] + $line['lineTaxCents']),
                'notes' => $line['notes'],
                'kitchen_status' => 'pending',
            ]);

            foreach ($line['addons'] as $addon) {
                $orderItem->addons()->create([
                    'addon_id' => $addon->id,
                    'name' => $addon->name,
                    'price' => $addon->price,
                    'quantity' => $line['quantity'],
                    'total' => $addon->price * $line['quantity'],
                ]);
            }

            $orderItemIds[] = $orderItem->id;
        }

        return $orderItemIds;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  'pos'|'qr'  $channel
     * @return array{
     *     lines: list<array<string, mixed>>,
     *     inventoryConsumption: array<int, float>,
     *     subtotalCents: int,
     *     discountCents: int,
     *     taxCents: int,
     *     serviceChargeCents: int,
     *     deliveryChargeCents: int,
     *     grandTotalCents: int
     * }
     */
    private function buildLines(array $payload, string $channel = 'pos'): array
    {
        $channelColumn = $channel === 'qr' ? 'qr_enabled' : 'pos_enabled';

        $dishIds = collect($payload['items'])->pluck('dish_id')->unique();
        $dishes = Dish::query()
            ->whereIn('id', $dishIds)
            ->where('is_active', true)->where('is_available', true)->where($channelColumn, true)
            ->with(['variants.recipe.items.inventoryItem', 'recipe.items.inventoryItem', 'addons'])
            ->get()->keyBy('id');

        if ($dishes->count() !== $dishIds->count()) {
            throw ValidationException::withMessages(['items' => ['One or more dishes are unavailable.']]);
        }

        $lines = [];
        $inventoryConsumption = [];
        $subtotalCents = 0;
        $itemDiscountCents = 0;
        $taxCents = 0;

        foreach ($payload['items'] as $index => $requestedItem) {
            $dish = $dishes->get($requestedItem['dish_id']);
            $variant = isset($requestedItem['dish_variant_id'])
                ? $dish->variants->firstWhere('id', $requestedItem['dish_variant_id'])
                : null;

            if (isset($requestedItem['dish_variant_id']) && ! $variant) {
                throw ValidationException::withMessages(["items.$index.dish_variant_id" => ['The selected variant does not belong to this dish.']]);
            }

            $addonIds = collect($requestedItem['addon_ids'] ?? []);
            $addons = $dish->addons->whereIn('id', $addonIds);
            if ($addons->count() !== $addonIds->unique()->count()) {
                throw ValidationException::withMessages(["items.$index.addon_ids" => ['An add-on is not available for this dish.']]);
            }

            $quantity = (int) $requestedItem['quantity'];
            $unitPriceCents = $this->toCents($variant?->price ?? $dish->base_price);
            $addonUnitCents = $addons->sum(fn (Addon $addon): int => $this->toCents($addon->price));
            $grossCents = ($unitPriceCents + $addonUnitCents) * $quantity;
            $discountCents = $this->toCents($requestedItem['discount'] ?? 0);

            if ($discountCents > $grossCents) {
                throw ValidationException::withMessages(["items.$index.discount" => ['Item discount cannot exceed the line total.']]);
            }

            $lineTaxCents = (int) round(($grossCents - $discountCents) * ((float) $dish->tax_percent / 100));
            $recipe = $variant?->recipe ?? $dish->recipe;

            if ($recipe) {
                foreach ($recipe->items as $recipeItem) {
                    $stockQuantity = $this->convertQuantity((float) $recipeItem->quantity, $recipeItem->unit, $recipeItem->inventoryItem->unit);
                    $stockQuantity *= 1 + ((float) $recipeItem->wastage_percent / 100);
                    $totalConsumption = $stockQuantity * $quantity;
                    $inventoryConsumption[$recipeItem->inventory_item_id] = ($inventoryConsumption[$recipeItem->inventory_item_id] ?? 0) + $totalConsumption;
                }
            }

            $subtotalCents += $grossCents;
            $itemDiscountCents += $discountCents;
            $taxCents += $lineTaxCents;
            $lines[] = compact('dish', 'variant', 'addons', 'quantity', 'unitPriceCents', 'grossCents', 'discountCents', 'lineTaxCents') + [
                'notes' => $requestedItem['notes'] ?? null,
            ];
        }

        $orderDiscountCents = $this->toCents($payload['discount_total'] ?? 0);
        $discountCents = $itemDiscountCents + $orderDiscountCents;
        $serviceChargeCents = $this->toCents($payload['service_charge'] ?? 0);
        $deliveryChargeCents = $this->toCents($payload['delivery_charge'] ?? 0);
        $grandTotalCents = max(0, $subtotalCents - $discountCents + $taxCents + $serviceChargeCents + $deliveryChargeCents);

        return [
            'lines' => $lines,
            'inventoryConsumption' => $inventoryConsumption,
            'subtotalCents' => $subtotalCents,
            'discountCents' => $discountCents,
            'taxCents' => $taxCents,
            'serviceChargeCents' => $serviceChargeCents,
            'deliveryChargeCents' => $deliveryChargeCents,
            'grandTotalCents' => $grandTotalCents,
        ];
    }

    /**
     * Recalculate recipe consumption for an existing order (QR accept path).
     *
     * @return array<int, float>
     */
    private function consumptionFromOrderItems(Order $order): array
    {
        $inventoryConsumption = [];

        foreach ($order->items as $item) {
            $recipe = $item->variant?->recipe ?? $item->dish?->recipe;
            if (! $recipe) {
                continue;
            }

            foreach ($recipe->items as $recipeItem) {
                if (! $recipeItem->inventoryItem) {
                    continue;
                }

                $stockQuantity = $this->convertQuantity(
                    (float) $recipeItem->quantity,
                    $recipeItem->unit,
                    $recipeItem->inventoryItem->unit
                );
                $stockQuantity *= 1 + ((float) $recipeItem->wastage_percent / 100);
                $totalConsumption = $stockQuantity * (int) $item->quantity;
                $inventoryConsumption[$recipeItem->inventory_item_id] =
                    ($inventoryConsumption[$recipeItem->inventory_item_id] ?? 0) + $totalConsumption;
            }
        }

        return $inventoryConsumption;
    }

    /**
     * Only created when `kitchen.enabled` and `order.auto_kitchen_send` are on, and only for
     * items whose dish is kitchen-enabled. No eligible items means no ticket.
     *
     * @param  list<int>  $orderItemIds
     */
    private function createKitchenTicket(Order $order, array $orderItemIds): ?KitchenTicket
    {
        if (! app(SettingsService::class)->kitchenAutoSendEnabled()) {
            return null;
        }

        $orderItemIds = OrderItem::query()
            ->whereIn('id', $orderItemIds)
            ->with('dish:id,kitchen_enabled')
            ->orderBy('id')
            ->get()
            ->filter(fn (OrderItem $item): bool => $item->dish === null || $item->dish->kitchen_enabled)
            ->pluck('id')
            ->all();

        if ($orderItemIds === []) {
            return null;
        }

        $ticket = KitchenTicket::query()->create([
            'order_id' => $order->id,
            'ticket_number' => 'PENDING-'.$order->id,
            'status' => 'new',
        ]);
        $ticket->update([
            'ticket_number' => sprintf('KT-%s-%06d', now()->format('Y'), $ticket->id),
        ]);

        foreach ($orderItemIds as $orderItemId) {
            $ticket->items()->create([
                'order_item_id' => $orderItemId,
                'status' => 'pending',
            ]);
        }

        return $ticket;
    }

    /** @param  array<int, float>  $consumption */
    private function consumeInventory(User $user, array $consumption, string $notes): void
    {
        foreach ($consumption as $itemId => $quantity) {
            $inventoryItem = InventoryItem::query()->lockForUpdate()->findOrFail($itemId);
            $before = (float) $inventoryItem->current_stock;
            $after = $before - $quantity;

            if ($after < 0) {
                throw ValidationException::withMessages(['items' => ["Insufficient stock for {$inventoryItem->name}."]]);
            }

            $inventoryItem->update(['current_stock' => $after]);
            app(LowStockNotifier::class)->check($inventoryItem, $before, $after);
            InventoryMovement::query()->create([
                'inventory_item_id' => $inventoryItem->id,
                'user_id' => $user->id,
                'type' => 'sale_consumption',
                'quantity' => -$quantity,
                'before_quantity' => $before,
                'after_quantity' => $after,
                'unit_cost' => $inventoryItem->average_cost,
                'notes' => $notes,
                'occurred_at' => now(),
            ]);
        }
    }

    private function assertValidStatus(string $status): void
    {
        $allowed = [
            'draft', 'pending', 'confirmed', 'preparing', 'ready', 'served',
            'out_for_delivery', 'completed', 'cancelled', 'refunded', 'partially_refunded',
        ];

        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid order status.']]);
        }
    }

    private function assertTransitionAllowed(string $from, string $to): void
    {
        if ($from === $to) {
            throw ValidationException::withMessages(['status' => ['Order is already in this status.']]);
        }

        $terminal = ['cancelled', 'completed'];
        if (in_array($from, $terminal, true) && ! in_array($to, ['refunded', 'partially_refunded'], true)) {
            throw ValidationException::withMessages(['status' => ["Cannot change status from {$from} to {$to}."]]);
        }

        if (in_array($from, ['refunded', 'partially_refunded'], true)) {
            throw ValidationException::withMessages(['status' => ['Refunded orders cannot change status.']]);
        }
    }

    private function convertQuantity(float $quantity, string $from, string $to): float
    {
        if ($from === $to) {
            return $quantity;
        }

        return match (strtolower($from).'->'.strtolower($to)) {
            'gram->kg', 'ml->liter' => $quantity / 1000,
            'kg->gram', 'liter->ml' => $quantity * 1000,
            default => throw ValidationException::withMessages(['items' => ["Cannot convert recipe unit {$from} to stock unit {$to}."]]),
        };
    }

    private function toCents(int|float|string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
