<?php

namespace App\Services;

use App\Models\Addon;
use App\Models\CashRegister;
use App\Models\Charge;
use App\Models\Customer;
use App\Models\Deal;
use App\Models\Dish;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\KitchenTicket;
use App\Models\PaymentMethod;
use App\Models\Recipe;
use App\Models\RestaurantTable;
use App\Models\Sale;
use App\Models\Tax;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class PosSaleService
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly CouponService $coupons,
        private readonly LoyaltyService $loyalty,
        private readonly DealService $deals,
    ) {}

    /**
     * Money formula (all arithmetic in integer cents):
     *
     *   subtotal        = Σ (unit price + add-ons) × qty
     *   itemDiscount    = Σ line discounts
     *   manualDiscount  = payload.discount_total
     *   couponDiscount  = CouponService::validate(code, subtotal − itemDiscount − manualDiscount)
     *   loyaltyDiscount = loyalty_points × loyalty.redemption_value
     *   discount_total  = itemDiscount + manualDiscount + couponDiscount + loyaltyDiscount
     *   netBase         = subtotal − discount_total
     *   lineTax         = Σ (gross − item discount) × dish.tax_percent
     *   settingsTax     = lineTax = 0 ? netBase × Σ active exclusive Tax.percentage : 0
     *   charges         = Σ active Charge (apply_to all|order_type): percent → netBase × value, fixed → value
     *                     (delivery bucket if code contains "delivery" or apply_to = delivery, else service bucket)
     *   grand_total     = netBase + lineTax + settingsTax + service_charge + delivery_charge
     *
     * Role cap (max_discount_percent × subtotal) applies to itemDiscount + manualDiscount + couponDiscount.
     * Loyalty redemption is a points tender, so it is bounded by loyalty.min/max_redemption instead.
     *
     * @param  array<string, mixed>  $payload
     */
    public function complete(User $cashier, array $payload): Sale
    {
        $existing = Sale::query()->where('uuid', $payload['uuid'])->first();

        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($cashier, $payload): Sale {
            $this->assertPosRules($cashier, $payload);

            $dishIds = collect($payload['items'] ?? [])->pluck('dish_id')->unique();
            $dishes = Dish::query()
                ->whereIn('id', $dishIds)
                ->where('is_active', true)->where('is_available', true)->where('pos_enabled', true)
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
            $estimatedCostCents = 0;

            foreach ($payload['items'] ?? [] as $index => $requestedItem) {
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
                $unitCostCents = $this->recipeUnitCost($variant?->recipe ?? $dish->recipe, $quantity, $inventoryConsumption);

                $subtotalCents += $grossCents;
                $itemDiscountCents += $discountCents;
                $taxCents += $lineTaxCents;
                $estimatedCostCents += $unitCostCents * $quantity;
                $lines[] = compact('dish', 'variant', 'addons', 'quantity', 'unitPriceCents', 'grossCents', 'discountCents', 'lineTaxCents', 'unitCostCents') + ['notes' => $requestedItem['notes'] ?? null, 'deal' => null];
            }

            // Deals are sold as their component dishes with the deal price split across them,
            // so kitchen tickets, stock consumption, receipts and refunds keep working per dish.
            $requestedDeals = collect($payload['deals'] ?? []);
            $deals = Deal::query()
                ->whereIn('id', $requestedDeals->pluck('deal_id')->unique())
                ->with(['items.dish.recipe.items.inventoryItem', 'items.variant.recipe.items.inventoryItem'])
                ->get()->keyBy('id');

            foreach ($requestedDeals as $index => $requestedDeal) {
                $deal = $deals->get($requestedDeal['deal_id']);
                if (! $deal || ! $this->deals->isSellable($deal)) {
                    throw ValidationException::withMessages(["deals.$index.deal_id" => ['This deal is not available right now.']]);
                }

                $dealQuantity = (int) $requestedDeal['quantity'];
                $dealNotes = 'Deal: '.$deal->name.(filled($requestedDeal['notes'] ?? null) ? ' - '.$requestedDeal['notes'] : '');

                foreach ($this->deals->allocate($deal) as $component) {
                    $dish = $component['item']->dish;
                    $variant = $component['item']->variant;
                    $quantity = $component['item']->quantity * $dealQuantity;
                    $grossCents = $component['share_cents'] * $dealQuantity;
                    $unitPriceCents = (int) round($grossCents / $quantity);
                    $lineTaxCents = (int) round($grossCents * ((float) $dish->tax_percent / 100));
                    $unitCostCents = $this->recipeUnitCost($variant?->recipe ?? $dish->recipe, $quantity, $inventoryConsumption);

                    $subtotalCents += $grossCents;
                    $taxCents += $lineTaxCents;
                    $estimatedCostCents += $unitCostCents * $quantity;
                    $lines[] = [
                        'dish' => $dish, 'variant' => $variant, 'addons' => collect(), 'quantity' => $quantity,
                        'unitPriceCents' => $unitPriceCents, 'grossCents' => $grossCents, 'discountCents' => 0,
                        'lineTaxCents' => $lineTaxCents, 'unitCostCents' => $unitCostCents, 'notes' => $dealNotes, 'deal' => $deal,
                    ];
                }
            }

            if ($lines === []) {
                throw ValidationException::withMessages(['items' => ['Add at least one item or deal.']]);
            }

            $customerId = isset($payload['customer_id']) ? (int) $payload['customer_id'] : null;

            // Manual order discount.
            $orderDiscountCents = $this->toCents($payload['discount_total'] ?? 0);

            // Coupon: validated against the order total after line + manual discounts (read-only here, redeemed after the sale is saved).
            $couponCode = filled($payload['coupon_code'] ?? null) ? (string) $payload['coupon_code'] : null;
            $couponDiscountCents = 0;
            $couponBaseCents = max(0, $subtotalCents - $itemDiscountCents - $orderDiscountCents);
            if ($couponCode !== null) {
                $validated = $this->coupons->validate($couponCode, $this->money($couponBaseCents), $customerId);
                $couponDiscountCents = $this->toCents($validated['discount_amount']);
                $couponCode = $validated['coupon']->code;
            }

            // Role cap covers line + manual + coupon discounts.
            $cappedDiscountCents = $itemDiscountCents + $orderDiscountCents + $couponDiscountCents;
            $maximumDiscountPercent = (float) ($cashier->roles()->max('max_discount_percent') ?? 0);
            if ($cappedDiscountCents > (int) round($subtotalCents * ($maximumDiscountPercent / 100))) {
                throw ValidationException::withMessages([
                    $couponDiscountCents > 0 && $orderDiscountCents === 0 && $itemDiscountCents === 0 ? 'coupon_code' : 'discount_total' => ["Your maximum allowed discount is {$maximumDiscountPercent}%."],
                ]);
            }

            // Loyalty redemption (points -> money), bounded by settings and the remaining payable amount.
            $loyaltyPoints = (int) ($payload['loyalty_points'] ?? 0);
            $loyaltyDiscountCents = $this->loyaltyRedemptionCents($customerId, $loyaltyPoints, max(0, $subtotalCents - $cappedDiscountCents));

            $discountCents = $cappedDiscountCents + $loyaltyDiscountCents;
            $netBaseCents = max(0, $subtotalCents - $discountCents);

            // Tax: dish-level tax is kept; the Tax table (active, exclusive) only applies when no dish contributed tax.
            // Inclusive taxes are already inside item prices and add nothing on top.
            if ($taxCents === 0) {
                $settingsRate = (float) Tax::query()->where('is_active', true)->where('is_inclusive', false)->sum('percentage');
                $taxCents = (int) round($netBaseCents * ($settingsRate / 100));
            }

            // Charges are always recomputed server-side; client service/delivery charges are ignored.
            [$serviceChargeCents, $deliveryChargeCents] = $this->computeCharges((string) $payload['order_type'], $netBaseCents);

            $grandTotalCents = max(0, $netBaseCents + $taxCents + $serviceChargeCents + $deliveryChargeCents);
            $payments = $payload['payments'] ?? [];
            $paymentStatus = in_array($payload['payment_status'] ?? null, ['paid', 'unpaid', 'pending'], true)
                ? $payload['payment_status'] : 'paid';
            $isDeferredPayment = $paymentStatus !== 'paid';
            $paymentMethodIds = collect($payments)->pluck('payment_method_id')->unique();
            $paymentMethods = PaymentMethod::query()->whereIn('id', $paymentMethodIds)->where('is_active', true)->get()->keyBy('id');

            if ($paymentMethods->count() !== $paymentMethodIds->count()) {
                throw ValidationException::withMessages(['payments' => ['One or more payment methods are unavailable.']]);
            }

            $paidCents = 0;
            foreach ($payments as $index => $payment) {
                $method = $paymentMethods->get($payment['payment_method_id']);
                if (($payload['was_offline'] ?? false) && ! $method->works_offline) {
                    throw ValidationException::withMessages(["payments.$index.payment_method_id" => ['This payment method cannot be used offline.']]);
                }
                if (! $isDeferredPayment && $method->requires_reference && blank($payment['reference'] ?? null)) {
                    throw ValidationException::withMessages(["payments.$index.reference" => ['A reference number is required.']]);
                }
                $paidCents += $this->toCents($payment['amount']);
            }

            // Unpaid / pending sales may be settled later, so they can be short (or have no payments at all).
            if (! $isDeferredPayment && $paidCents < $grandTotalCents) {
                throw ValidationException::withMessages(['payments' => ['Payment amount is less than the sale total.']]);
            }

            $changeCents = max(0, $paidCents - $grandTotalCents);
            $deliveryName = filled($payload['delivery_name'] ?? null) ? trim((string) $payload['delivery_name']) : null;
            $deliveryAddress = filled($payload['delivery_address'] ?? null) ? trim((string) $payload['delivery_address']) : null;
            $saleNotes = $this->composeSaleNotes($payload['notes'] ?? null, [
                'processing_minutes' => isset($payload['processing_minutes']) ? (int) $payload['processing_minutes'] : null,
                'custom_slip_message' => filled($payload['custom_slip_message'] ?? null) ? trim((string) $payload['custom_slip_message']) : null,
                'delivery_name' => $deliveryName,
            ]);

            $this->consumeInventory($cashier, $inventoryConsumption, $payload['uuid']);
            $now = now();
            $orderRow = [
                'uuid' => $payload['uuid'], 'order_number' => 'PENDING-'.$payload['uuid'],
                'customer_id' => $payload['customer_id'] ?? null, 'restaurant_table_id' => $payload['restaurant_table_id'] ?? null,
                'created_by' => $cashier->id, 'source' => 'pos', 'order_type' => $payload['order_type'], 'status' => 'completed',
                'notes' => $payload['notes'] ?? null, 'subtotal' => $this->money($subtotalCents),
                'discount_total' => $this->money($discountCents), 'tax_total' => $this->money($taxCents),
                'service_charge' => $this->money($serviceChargeCents), 'delivery_charge' => $this->money($deliveryChargeCents),
                'grand_total' => $this->money($grandTotalCents), 'ordered_at' => $now, 'created_at' => $now, 'updated_at' => $now,
            ];
            if (Schema::hasColumn('orders', 'payment_status')) {
                $orderRow['payment_status'] = $paymentStatus;
            }
            if (($payload['order_type'] ?? null) === 'delivery' && $deliveryAddress !== null) {
                $orderRow['delivery_address'] = $deliveryAddress;
            }
            $orderId = DB::table('orders')->insertGetId($orderRow);
            DB::table('orders')->where('id', $orderId)->update(['order_number' => $this->settings->formatOrderNumber($orderId)]);

            $sale = Sale::query()->create([
                'uuid' => $payload['uuid'], 'invoice_number' => 'PENDING-'.$payload['uuid'], 'order_id' => $orderId,
                'customer_id' => $payload['customer_id'] ?? null, 'restaurant_table_id' => $payload['restaurant_table_id'] ?? null,
                'cashier_id' => $cashier->id, 'order_type' => $payload['order_type'], 'status' => 'completed',
                'was_offline' => $payload['was_offline'] ?? false, 'subtotal' => $this->money($subtotalCents),
                'discount_total' => $this->money($discountCents), 'tax_total' => $this->money($taxCents),
                'service_charge' => $this->money($serviceChargeCents), 'delivery_charge' => $this->money($deliveryChargeCents),
                'grand_total' => $this->money($grandTotalCents), 'paid_total' => $this->money($paidCents),
                'change_total' => $this->money($changeCents), 'notes' => $saleNotes, 'sold_at' => $now,
            ]);
            $sale->update(['invoice_number' => $this->settings->formatInvoiceNumber($sale->id)]);

            if ($couponCode !== null) {
                $this->coupons->redeem($couponCode, $this->money($couponBaseCents), $customerId, $orderId, $sale->id);
            }
            if ($customerId !== null) {
                if ($loyaltyPoints > 0) {
                    $this->loyalty->record($cashier, $customerId, 'redeem', -$loyaltyPoints, "Redeemed on {$sale->invoice_number}", $sale);
                }
                $earned = $this->loyaltyEarnPoints($grandTotalCents);
                if ($earned > 0) {
                    $this->loyalty->record($cashier, $customerId, 'earn', $earned, "Earned on {$sale->invoice_number}", $sale);
                }
            }

            $orderItemIds = [];
            $kitchenItemIds = [];
            foreach ($lines as $line) {
                $saleItem = $sale->items()->create([
                    'dish_id' => $line['dish']->id, 'dish_variant_id' => $line['variant']?->id,
                    'deal_id' => $line['deal']?->id, 'deal_name' => $line['deal']?->name,
                    'dish_name' => $line['dish']->name, 'sku' => $line['variant']?->sku ?? $line['dish']->sku,
                    'variant_name' => $line['variant']?->name, 'quantity' => $line['quantity'],
                    'unit_price' => $this->money($line['unitPriceCents']), 'unit_cost' => $this->money($line['unitCostCents']),
                    'discount' => $this->money($line['discountCents']), 'tax' => $this->money($line['lineTaxCents']),
                    'total' => $this->money($line['grossCents'] - $line['discountCents'] + $line['lineTaxCents']), 'notes' => $line['notes'],
                ]);
                $orderItemId = DB::table('order_items')->insertGetId([
                    'order_id' => $orderId, 'dish_id' => $line['dish']->id, 'dish_variant_id' => $line['variant']?->id,
                    'deal_id' => $line['deal']?->id, 'deal_name' => $line['deal']?->name,
                    'dish_name' => $line['dish']->name, 'variant_name' => $line['variant']?->name, 'quantity' => $line['quantity'],
                    'unit_price' => $this->money($line['unitPriceCents']), 'discount' => $this->money($line['discountCents']),
                    'tax' => $this->money($line['lineTaxCents']), 'total' => $this->money($line['grossCents'] - $line['discountCents'] + $line['lineTaxCents']),
                    'notes' => $line['notes'], 'kitchen_status' => 'pending', 'created_at' => $now, 'updated_at' => $now,
                ]);
                $orderItemIds[] = $orderItemId;
                if ($line['dish']->kitchen_enabled) {
                    $kitchenItemIds[] = $orderItemId;
                }
                foreach ($line['addons'] as $addon) {
                    $addonData = ['addon_id' => $addon->id, 'name' => $addon->name, 'price' => $addon->price, 'quantity' => $line['quantity'], 'total' => $addon->price * $line['quantity'], 'created_at' => $now, 'updated_at' => $now];
                    DB::table('sale_item_addons')->insert(['sale_item_id' => $saleItem->id] + $addonData);
                    DB::table('order_item_addons')->insert(['order_item_id' => $orderItemId] + $addonData);
                }
            }

            $cashPaidCents = 0;
            foreach ($payments as $payment) {
                if ($this->toCents($payment['amount']) <= 0) {
                    continue;
                }
                $sale->payments()->create([
                    'payment_method_id' => $payment['payment_method_id'], 'received_by' => $cashier->id,
                    'amount' => $payment['amount'], 'reference' => $payment['reference'] ?? null, 'paid_at' => $now,
                ]);
                if ($this->isCashMethod($paymentMethods->get($payment['payment_method_id']))) {
                    $cashPaidCents += $this->toCents($payment['amount']);
                }
            }

            // Record the cash drawer entry straight away (net of change given back) so the open register stays current.
            $cashNetCents = max(0, $cashPaidCents - $changeCents);
            if ($cashNetCents > 0) {
                app(CashRegisterService::class)->recordCashSale($cashier, $sale, $this->money($cashNetCents));
            }

            if ($kitchenItemIds !== [] && $this->settings->kitchenAutoSendEnabled()
                && ! KitchenTicket::query()->where('order_id', $orderId)->exists()) {
                $ticketId = DB::table('kitchen_tickets')->insertGetId([
                    'order_id' => $orderId,
                    'ticket_number' => 'PENDING-'.$orderId,
                    'status' => 'new',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('kitchen_tickets')->where('id', $ticketId)->update([
                    'ticket_number' => sprintf('KT-%s-%06d', $now->format('Y'), $ticketId),
                ]);
                foreach ($kitchenItemIds as $orderItemId) {
                    DB::table('kitchen_ticket_items')->insert([
                        'kitchen_ticket_id' => $ticketId,
                        'order_item_id' => $orderItemId,
                        'status' => 'pending',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            if (($payload['order_type'] ?? null) === 'dine_in' && ! empty($payload['restaurant_table_id'])) {
                RestaurantTable::query()
                    ->whereKey($payload['restaurant_table_id'])
                    ->update(['status' => 'cleaning']);
            }

            if (($payload['order_type'] ?? null) === 'delivery') {
                DB::table('deliveries')->insert([
                    'order_id' => $orderId,
                    'customer_id' => $payload['customer_id'] ?? null,
                    // The deliveries table has no name column, so the recipient name leads the address.
                    'address' => ($deliveryName !== null ? $deliveryName.' - ' : '').($deliveryAddress ?? $payload['notes'] ?? 'Address pending'),
                    'phone' => filled($payload['delivery_phone'] ?? null) ? trim((string) $payload['delivery_phone']) : '0000000000',
                    'delivery_charge' => $this->money($deliveryChargeCents),
                    'cod_amount' => $isDeferredPayment ? $this->money(max(0, $grandTotalCents - $paidCents)) : 0,
                    'status' => 'pending',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('sync_records')->updateOrInsert(['client_uuid' => $payload['uuid']], [
                'user_id' => $cashier->id, 'entity_type' => 'sale', 'entity_id' => $sale->id,
                'status' => 'synced', 'synced_at' => $now, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('activity_logs')->insert([
                'user_id' => $cashier->id, 'action' => 'sale.completed', 'module' => 'pos',
                'subject_type' => Sale::class, 'subject_id' => $sale->id,
                'after_data' => json_encode(['invoice_number' => $sale->invoice_number, 'total' => $sale->grand_total, 'estimated_cost' => $this->money($estimatedCostCents)]),
                'created_at' => $now,
            ]);

            return $sale->fresh();
        }, 3);
    }

    /** @param array<string, mixed> $payload */
    private function assertPosRules(User $cashier, array $payload): void
    {
        $customerId = $payload['customer_id'] ?? null;
        $orderType = $payload['order_type'] ?? null;

        if ($this->settings->get('pos.require_customer', false) && blank($customerId)) {
            throw ValidationException::withMessages(['customer_id' => ['A customer is required for POS sales.']]);
        }

        if ($this->settings->get('pos.require_table', false) && $orderType === 'dine_in' && blank($payload['restaurant_table_id'] ?? null)) {
            throw ValidationException::withMessages(['restaurant_table_id' => ['A table is required for dine-in sales.']]);
        }

        // Offline sales are validated when they were rung up; the register may be closed by the time they sync.
        if ($this->settings->get('pos.require_register', false) && ! ($payload['was_offline'] ?? false)
            && ! CashRegister::query()->where('user_id', $cashier->id)->where('status', 'open')->exists()) {
            throw ValidationException::withMessages(['cash_register' => ['Open a cash register before making sales.']]);
        }

        if (! $this->settings->get('pos.allow_discounts', true)) {
            $itemDiscount = collect($payload['items'] ?? [])->sum(fn (array $item): int => $this->toCents($item['discount'] ?? 0));
            foreach ([
                'discount_total' => $this->toCents($payload['discount_total'] ?? 0) > 0 || $itemDiscount > 0,
                'coupon_code' => filled($payload['coupon_code'] ?? null),
                'loyalty_points' => (int) ($payload['loyalty_points'] ?? 0) > 0,
            ] as $field => $used) {
                if ($used) {
                    throw ValidationException::withMessages([$field => ['Discounts are disabled for POS sales.']]);
                }
            }
        }
    }

    private function loyaltyRedemptionCents(?int $customerId, int $points, int $maxCents): int
    {
        if ($points <= 0) {
            return 0;
        }
        if ($customerId === null) {
            throw ValidationException::withMessages(['loyalty_points' => ['A customer is required to redeem loyalty points.']]);
        }
        if (! $this->settings->get('loyalty.enabled', false)) {
            throw ValidationException::withMessages(['loyalty_points' => ['The loyalty program is disabled.']]);
        }

        $minimum = (int) $this->settings->get('loyalty.min_redemption', 0);
        $maximum = (int) $this->settings->get('loyalty.max_redemption', 0);
        if ($points < $minimum) {
            throw ValidationException::withMessages(['loyalty_points' => ["The minimum redemption is {$minimum} points."]]);
        }
        if ($maximum > 0 && $points > $maximum) {
            throw ValidationException::withMessages(['loyalty_points' => ["The maximum redemption per sale is {$maximum} points."]]);
        }

        $balance = (int) Customer::query()->whereKey($customerId)->value('loyalty_points');
        if ($points > $balance) {
            throw ValidationException::withMessages(['loyalty_points' => ["Insufficient loyalty points. The customer has {$balance} point(s)."]]);
        }

        $cents = (int) round($points * (float) $this->settings->get('loyalty.redemption_value', 0) * 100);
        if ($cents > $maxCents) {
            throw ValidationException::withMessages(['loyalty_points' => ['Redeemed points exceed the amount payable on this sale.']]);
        }

        return $cents;
    }

    private function loyaltyEarnPoints(int $grandTotalCents): int
    {
        if (! $this->settings->get('loyalty.enabled', false)) {
            return 0;
        }

        $spendCents = (int) round((float) $this->settings->get('loyalty.spend_amount', 0) * 100);
        if ($spendCents <= 0) {
            return 0;
        }

        return (int) floor(intdiv($grandTotalCents, $spendCents) * (float) $this->settings->get('loyalty.points_earned', 0));
    }

    /** @return array{0: int, 1: int} [service cents, delivery cents] */
    private function computeCharges(string $orderType, int $netBaseCents): array
    {
        $service = 0;
        $delivery = 0;

        $charges = Charge::query()->where('is_active', true)
            ->whereIn('apply_to', ['all', $orderType])->get();

        foreach ($charges as $charge) {
            $cents = $charge->type === 'percent'
                ? (int) round($netBaseCents * ((float) $charge->value / 100))
                : $this->toCents($charge->value);

            if ($charge->apply_to === 'delivery' || str_contains(strtolower((string) $charge->code), 'delivery')) {
                $delivery += $cents;
            } else {
                $service += $cents;
            }
        }

        return [$service, $delivery];
    }

    private function isCashMethod(?PaymentMethod $method): bool
    {
        if (! $method) {
            return false;
        }

        return strtolower((string) $method->code) === 'cash' || str_contains(strtolower((string) $method->name), 'cash');
    }

    /**
     * Free-text notes followed by a structured JSON suffix (see Sale::posMeta()) holding
     * the receipt extras: processing time, custom slip message and delivery recipient name.
     *
     * @param  array<string, mixed>  $meta
     */
    private function composeSaleNotes(?string $notes, array $meta): ?string
    {
        $meta = array_filter($meta, fn (mixed $value): bool => $value !== null && $value !== '');

        if ($meta === []) {
            return $notes;
        }

        return trim(($notes ?? '')."\n".Sale::POS_META_MARKER.json_encode($meta, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Cost of one unit from its recipe; adds the stock used by $quantity units to $inventoryConsumption.
     *
     * @param  array<int, float>  $inventoryConsumption
     */
    private function recipeUnitCost(?Recipe $recipe, int $quantity, array &$inventoryConsumption): int
    {
        $unitCostCents = 0;

        foreach ($recipe?->items ?? [] as $recipeItem) {
            $stockQuantity = $this->convertQuantity((float) $recipeItem->quantity, $recipeItem->unit, $recipeItem->inventoryItem->unit);
            $stockQuantity *= 1 + ((float) $recipeItem->wastage_percent / 100);
            $inventoryConsumption[$recipeItem->inventory_item_id] = ($inventoryConsumption[$recipeItem->inventory_item_id] ?? 0) + $stockQuantity * $quantity;
            $unitCostCents += (int) round($stockQuantity * $this->toCents($recipeItem->inventoryItem->average_cost));
        }

        return $unitCostCents;
    }

    private function consumeInventory(User $cashier, array $consumption, string $saleUuid): void
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
                'inventory_item_id' => $inventoryItem->id, 'user_id' => $cashier->id, 'type' => 'sale_consumption',
                'quantity' => -$quantity, 'before_quantity' => $before, 'after_quantity' => $after,
                'unit_cost' => $inventoryItem->average_cost, 'notes' => "POS sale {$saleUuid}", 'occurred_at' => now(),
            ]);
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
