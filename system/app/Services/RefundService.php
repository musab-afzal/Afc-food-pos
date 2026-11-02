<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\OrderStatusHistory;
use App\Models\PaymentMethod;
use App\Models\Recipe;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RefundService
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * @param  array<string, mixed>  $filters  sale_id, from, to, search, per_page
     */
    public function list(array $filters): LengthAwarePaginator
    {
        return Refund::query()
            ->with(['sale:id,invoice_number,grand_total,sold_at', 'user:id,name', 'paymentMethod:id,name,code'])
            ->withCount('items')
            ->when(! empty($filters['sale_id']), fn ($query) => $query->where('sale_id', (int) $filters['sale_id']))
            ->when(! empty($filters['from']), fn ($query) => $query->whereDate('refunded_at', '>=', $filters['from']))
            ->when(! empty($filters['to']), fn ($query) => $query->whereDate('refunded_at', '<=', $filters['to']))
            ->when(! empty($filters['search']), function ($query) use ($filters): void {
                $search = '%'.$filters['search'].'%';
                $query->where(fn ($nested) => $nested
                    ->where('refund_number', 'like', $search)
                    ->orWhere('reason', 'like', $search));
            })
            ->orderByDesc('refunded_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();
    }

    public function forSale(Sale $sale, int $perPage = 50): LengthAwarePaginator
    {
        return $this->list(['sale_id' => $sale->id, 'per_page' => $perPage]);
    }

    public function show(Refund $refund): Refund
    {
        return $refund->load([
            'sale:id,invoice_number,order_id,grand_total,paid_total,status,sold_at',
            'user:id,name',
            'paymentMethod:id,name,code',
            'items.saleItem:id,sale_id,dish_id,dish_variant_id,dish_name,variant_name,quantity,unit_price,total',
        ]);
    }

    /**
     * Refundable summary per sale line (used by clients to build the refund form).
     *
     * @return array<string, mixed>
     */
    public function summary(Sale $sale): array
    {
        $sale->load('items');
        $refunded = $this->refundedQuantities($sale);
        $priorTotalCents = $this->priorRefundCents($sale);

        return [
            'sale_id' => $sale->id,
            'grand_total' => $sale->grand_total,
            'refunded_total' => $this->money($priorTotalCents),
            'refundable_total' => $this->money(max(0, $this->toCents($sale->grand_total) - $priorTotalCents)),
            'items' => $sale->items->map(fn (SaleItem $item): array => [
                'sale_item_id' => $item->id,
                'dish_name' => $item->dish_name,
                'quantity' => $item->quantity,
                'refunded_quantity' => $refunded[$item->id] ?? 0,
                'refundable_quantity' => $item->quantity - ($refunded[$item->id] ?? 0),
            ])->values()->all(),
        ];
    }

    /**
     * @param  array{sale_id: int, reason: string, payment_method_id?: int|null, restore_inventory?: bool, items?: list<array{sale_item_id: int, quantity: int}>|null}  $payload
     */
    public function create(User $user, array $payload): Refund
    {
        return DB::transaction(function () use ($user, $payload): Refund {
            // Lock the sale row so concurrent refunds serialize.
            $sale = Sale::query()->lockForUpdate()->findOrFail($payload['sale_id']);
            $sale->load('items');

            if ($sale->status === 'cancelled') {
                throw ValidationException::withMessages(['sale_id' => ['A cancelled sale cannot be refunded.']]);
            }

            if (! empty($payload['payment_method_id'])
                && ! PaymentMethod::query()->whereKey($payload['payment_method_id'])->where('is_active', true)->exists()) {
                throw ValidationException::withMessages(['payment_method_id' => ['The selected payment method is unavailable.']]);
            }

            $refundedQty = $this->refundedQuantities($sale);
            $priorCents = $this->priorRefundCents($sale);
            $grandCents = $this->toCents($sale->grand_total);
            $remainingCents = $grandCents - $priorCents;

            if ($remainingCents <= 0) {
                throw ValidationException::withMessages(['sale_id' => ['This sale has already been fully refunded.']]);
            }

            $requested = $this->resolveRequestedLines($sale, $refundedQty, $payload['items'] ?? null);

            // Line totals are scaled down when an order-level discount makes grand_total < sum(line totals).
            $lineSumCents = $sale->items->sum(fn (SaleItem $item): int => $this->toCents($item->total));
            $scale = ($lineSumCents > $grandCents && $lineSumCents > 0) ? $grandCents / $lineSumCents : 1.0;

            $lines = [];
            $amountCents = 0;
            foreach ($requested as $saleItemId => $quantity) {
                /** @var SaleItem $saleItem */
                $saleItem = $sale->items->firstWhere('id', $saleItemId);
                $already = $refundedQty[$saleItemId] ?? 0;
                $effective = (int) round($this->toCents($saleItem->total) * $scale);
                // Cumulative pro-rating avoids drifting by cents across partial refunds.
                $lineCents = (int) round($effective * ($already + $quantity) / $saleItem->quantity)
                    - (int) round($effective * $already / $saleItem->quantity);
                $amountCents += $lineCents;
                $lines[] = ['sale_item' => $saleItem, 'quantity' => $quantity, 'amount_cents' => $lineCents];
            }

            // Final refund that exhausts every line also returns non-line charges (service/delivery/rounding).
            $exhausted = $sale->items->every(
                fn (SaleItem $item): bool => ($refundedQty[$item->id] ?? 0) + ($requested[$item->id] ?? 0) >= $item->quantity
            );
            if ($exhausted) {
                $amountCents = $remainingCents;
            }

            if ($amountCents <= 0) {
                throw ValidationException::withMessages(['items' => ['Refund amount must be greater than zero.']]);
            }

            if ($amountCents > $remainingCents) {
                throw ValidationException::withMessages(['items' => ['Refund amount exceeds the remaining refundable total of '.$this->money($remainingCents).'.']]);
            }

            $now = now();
            $restore = (bool) ($payload['restore_inventory'] ?? false);

            $refund = Refund::query()->create([
                'refund_number' => 'PENDING-'.str()->uuid(),
                'sale_id' => $sale->id,
                'user_id' => $user->id,
                'payment_method_id' => $payload['payment_method_id'] ?? null,
                'amount' => $this->money($amountCents),
                'reason' => $payload['reason'],
                'restore_inventory' => $restore,
                'refunded_at' => $now,
            ]);
            $refund->update(['refund_number' => sprintf('REF-%s-%06d', $now->format('Y'), $refund->id)]);

            foreach ($lines as $line) {
                RefundItem::query()->create([
                    'refund_id' => $refund->id,
                    'sale_item_id' => $line['sale_item']->id,
                    'quantity' => $line['quantity'],
                    'amount' => $this->money($line['amount_cents']),
                ]);
            }

            if ($restore) {
                $this->restoreInventory($refund, $lines, $user);
            }

            $this->syncOrderStatus($sale, $exhausted, $refund, $user);

            return $this->show($refund->fresh());
        }, 3);
    }

    /**
     * @param  array<int, int>  $refundedQty
     * @param  list<array{sale_item_id: int, quantity: int}>|null  $items
     * @return array<int, int> sale_item_id => quantity
     */
    private function resolveRequestedLines(Sale $sale, array $refundedQty, ?array $items): array
    {
        $requested = [];

        if ($items === null || $items === []) {
            foreach ($sale->items as $item) {
                $left = $item->quantity - ($refundedQty[$item->id] ?? 0);
                if ($left > 0) {
                    $requested[$item->id] = $left;
                }
            }
        } else {
            foreach ($items as $index => $line) {
                $itemId = (int) $line['sale_item_id'];
                $saleItem = $sale->items->firstWhere('id', $itemId);
                if (! $saleItem) {
                    throw ValidationException::withMessages(["items.$index.sale_item_id" => ['This line does not belong to the sale.']]);
                }
                $requested[$itemId] = ($requested[$itemId] ?? 0) + (int) $line['quantity'];
            }

            foreach ($requested as $itemId => $quantity) {
                $saleItem = $sale->items->firstWhere('id', $itemId);
                $left = $saleItem->quantity - ($refundedQty[$itemId] ?? 0);
                if ($quantity < 1 || $quantity > $left) {
                    throw ValidationException::withMessages(['items' => ["Cannot refund {$quantity} x {$saleItem->dish_name}; only {$left} refundable."]]);
                }
            }
        }

        if ($requested === []) {
            throw ValidationException::withMessages(['items' => ['Nothing left to refund on this sale.']]);
        }

        return $requested;
    }

    /**
     * Reverse recipe consumption (mirrors PosSaleService::consumeInventory) as `return` movements.
     *
     * @param  list<array{sale_item: SaleItem, quantity: int, amount_cents: int}>  $lines
     */
    private function restoreInventory(Refund $refund, array $lines, User $user): void
    {
        $restore = [];

        foreach ($lines as $line) {
            /** @var SaleItem $saleItem */
            $saleItem = $line['sale_item'];

            $recipe = null;
            if ($saleItem->dish_variant_id) {
                $recipe = Recipe::query()->with('items.inventoryItem')->where('dish_variant_id', $saleItem->dish_variant_id)->first();
            }
            if (! $recipe && $saleItem->dish_id) {
                $recipe = Recipe::query()->with('items.inventoryItem')
                    ->where('dish_id', $saleItem->dish_id)->whereNull('dish_variant_id')->first();
            }
            if (! $recipe) {
                continue;
            }

            foreach ($recipe->items as $recipeItem) {
                if (! $recipeItem->inventoryItem) {
                    continue;
                }
                $stockQty = $this->convertQuantity((float) $recipeItem->quantity, $recipeItem->unit, $recipeItem->inventoryItem->unit);
                $stockQty *= 1 + ((float) $recipeItem->wastage_percent / 100);
                $restore[$recipeItem->inventory_item_id] = ($restore[$recipeItem->inventory_item_id] ?? 0) + $stockQty * $line['quantity'];
            }
        }

        foreach ($restore as $itemId => $quantity) {
            if ($quantity <= 0) {
                continue;
            }
            $this->inventory->adjustStock(
                InventoryItem::query()->findOrFail($itemId),
                round($quantity, 4),
                'return',
                $user,
                "Refund {$refund->refund_number} (sale return)",
                $refund,
            );
        }
    }

    private function syncOrderStatus(Sale $sale, bool $fullyRefunded, Refund $refund, User $user): void
    {
        // Sale.status is intentionally left as `completed`: dashboards/reports sum completed sales and
        // subtract the refunds table separately, so flipping it would double-count the deduction.
        if (! $sale->order_id) {
            return;
        }

        $order = $sale->order;
        if (! $order) {
            return;
        }

        $to = $fullyRefunded ? 'refunded' : 'partially_refunded';
        if ($order->status === $to) {
            return;
        }

        $from = $order->status;
        $order->update(['status' => $to]);
        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => "Refund {$refund->refund_number}",
        ]);
    }

    /** @return array<int, int> sale_item_id => refunded quantity */
    private function refundedQuantities(Sale $sale): array
    {
        return RefundItem::query()
            ->join('refunds', 'refunds.id', '=', 'refund_items.refund_id')
            ->where('refunds.sale_id', $sale->id)
            ->groupBy('refund_items.sale_item_id')
            ->selectRaw('refund_items.sale_item_id as sale_item_id, SUM(refund_items.quantity) as qty')
            ->pluck('qty', 'sale_item_id')
            ->map(fn ($qty): int => (int) $qty)
            ->all();
    }

    private function priorRefundCents(Sale $sale): int
    {
        return $this->toCents(Refund::query()->where('sale_id', $sale->id)->sum('amount'));
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

    private function toCents(int|float|string|null $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
