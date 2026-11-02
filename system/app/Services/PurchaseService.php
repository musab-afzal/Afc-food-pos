<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseReceipt;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(User $user, array $payload): Purchase
    {
        return DB::transaction(function () use ($user, $payload): Purchase {
            $totals = $this->computeTotals($payload);

            $purchase = Purchase::query()->create([
                'purchase_number' => 'PENDING',
                'supplier_id' => $payload['supplier_id'],
                'user_id' => $user->id,
                'purchase_date' => $payload['purchase_date'] ?? now()->toDateString(),
                'invoice_reference' => $payload['invoice_reference'] ?? null,
                'status' => 'draft',
                'payment_status' => 'unpaid',
                'subtotal' => $totals['subtotal'],
                'discount' => $totals['discount'],
                'tax' => $totals['tax'],
                'other_charges' => $totals['other_charges'],
                'total' => $totals['total'],
                'paid' => 0,
                'remaining' => $totals['total'],
                'payment_method' => $payload['payment_method'] ?? null,
                'notes' => $payload['notes'] ?? null,
            ]);

            $purchase->update([
                'purchase_number' => sprintf('PO-%s-%06d', now()->format('Y'), $purchase->id),
            ]);

            $this->syncItems($purchase, $payload['items']);

            return $purchase->fresh(['supplier', 'items.inventoryItem', 'user:id,name']);
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function update(Purchase $purchase, array $payload): Purchase
    {
        if ($purchase->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft purchases can be edited.']]);
        }

        return DB::transaction(function () use ($purchase, $payload): Purchase {
            $totals = $this->computeTotals($payload);

            $purchase->update([
                'supplier_id' => $payload['supplier_id'],
                'purchase_date' => $payload['purchase_date'] ?? $purchase->purchase_date,
                'invoice_reference' => $payload['invoice_reference'] ?? null,
                'subtotal' => $totals['subtotal'],
                'discount' => $totals['discount'],
                'tax' => $totals['tax'],
                'other_charges' => $totals['other_charges'],
                'total' => $totals['total'],
                'remaining' => $totals['total'] - (float) $purchase->paid,
                'payment_method' => $payload['payment_method'] ?? null,
                'notes' => $payload['notes'] ?? null,
            ]);

            $purchase->items()->delete();
            $this->syncItems($purchase, $payload['items']);

            return $purchase->fresh(['supplier', 'items.inventoryItem', 'user:id,name']);
        });
    }

    public function submit(Purchase $purchase): Purchase
    {
        if ($purchase->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft purchases can be submitted.']]);
        }
        if ($purchase->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Add at least one item before submitting.']]);
        }

        $purchase->update(['status' => 'ordered']);

        return $purchase->fresh(['supplier', 'items.inventoryItem', 'user:id,name']);
    }

    public function cancel(Purchase $purchase): Purchase
    {
        if (in_array($purchase->status, ['received', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => ['This purchase cannot be cancelled.']]);
        }
        if ((float) $purchase->items()->sum('quantity_received') > 0) {
            throw ValidationException::withMessages(['status' => ['Cannot cancel a purchase with received stock.']]);
        }

        $purchase->update(['status' => 'cancelled']);

        return $purchase->fresh(['supplier', 'items.inventoryItem', 'user:id,name']);
    }

    /**
     * @param  array{
     *     items: list<array{purchase_item_id: int, quantity: float|int|string}>,
     *     notes?: string|null,
     *     received_at?: string|null
     * }  $payload
     */
    public function receive(Purchase $purchase, User $user, array $payload): Purchase
    {
        if (! in_array($purchase->status, ['ordered', 'partial'], true)) {
            throw ValidationException::withMessages(['status' => ['Purchase must be ordered before receiving.']]);
        }

        return DB::transaction(function () use ($purchase, $user, $payload): Purchase {
            $purchase = Purchase::query()->lockForUpdate()->with('items.inventoryItem')->findOrFail($purchase->id);

            $receipt = PurchaseReceipt::query()->create([
                'receipt_number' => 'PENDING',
                'purchase_id' => $purchase->id,
                'user_id' => $user->id,
                'received_at' => $payload['received_at'] ?? now()->toDateString(),
                'notes' => $payload['notes'] ?? null,
            ]);
            $receipt->update([
                'receipt_number' => sprintf('GRN-%s-%06d', now()->format('Y'), $receipt->id),
            ]);

            foreach ($payload['items'] as $index => $line) {
                $item = $purchase->items->firstWhere('id', (int) $line['purchase_item_id']);
                if (! $item) {
                    throw ValidationException::withMessages([
                        "items.{$index}.purchase_item_id" => ['Item does not belong to this purchase.'],
                    ]);
                }

                $qty = (float) $line['quantity'];
                if ($qty <= 0) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ['Receive quantity must be greater than zero.'],
                    ]);
                }

                $remaining = (float) $item->quantity - (float) $item->quantity_received;
                if ($qty > $remaining + 0.0001) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ["Cannot receive more than remaining {$remaining}."],
                    ]);
                }

                $item->update(['quantity_received' => (float) $item->quantity_received + $qty]);

                $receipt->items()->create([
                    'purchase_item_id' => $item->id,
                    'inventory_item_id' => $item->inventory_item_id,
                    'quantity' => $qty,
                    'unit' => $item->unit,
                    'unit_cost' => $item->unit_cost,
                ]);

                $this->inventory->adjustStock(
                    $item->inventoryItem,
                    $qty,
                    'purchase_receipt',
                    $user,
                    "PO {$purchase->purchase_number} / {$receipt->receipt_number}",
                    $receipt,
                    (float) $item->unit_cost,
                );
            }

            $purchase->load('items');
            $ordered = (float) $purchase->items->sum('quantity');
            $received = (float) $purchase->items->sum('quantity_received');
            $status = $received + 0.0001 >= $ordered ? 'received' : 'partial';
            $wasFullyReceived = $purchase->status !== 'received' && $status === 'received';
            $purchase->update(['status' => $status]);

            if ($wasFullyReceived) {
                Supplier::query()->whereKey($purchase->supplier_id)->increment('current_payable', (float) $purchase->remaining);
            }

            return $purchase->fresh([
                'supplier',
                'items.inventoryItem',
                'user:id,name',
                'receipts.items',
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{subtotal: string, discount: string, tax: string, other_charges: string, total: string}
     */
    private function computeTotals(array $payload): array
    {
        $subtotal = 0.0;
        foreach ($payload['items'] as $index => $line) {
            InventoryItem::query()->whereKey($line['inventory_item_id'])->where('is_active', true)->firstOrFail();
            $qty = (float) $line['quantity'];
            $cost = (float) $line['unit_cost'];
            if ($qty <= 0) {
                throw ValidationException::withMessages(["items.{$index}.quantity" => ['Quantity must be greater than zero.']]);
            }
            $subtotal += $qty * $cost;
        }

        $discount = (float) ($payload['discount'] ?? 0);
        $tax = (float) ($payload['tax'] ?? 0);
        $other = (float) ($payload['other_charges'] ?? 0);
        $total = max(0, $subtotal - $discount + $tax + $other);

        return [
            'subtotal' => number_format($subtotal, 2, '.', ''),
            'discount' => number_format($discount, 2, '.', ''),
            'tax' => number_format($tax, 2, '.', ''),
            'other_charges' => number_format($other, 2, '.', ''),
            'total' => number_format($total, 2, '.', ''),
        ];
    }

    /**
     * @param  list<array{inventory_item_id: int, quantity: float|int|string, unit?: string, unit_cost: float|int|string}>  $items
     */
    private function syncItems(Purchase $purchase, array $items): void
    {
        foreach ($items as $line) {
            $item = InventoryItem::query()->findOrFail($line['inventory_item_id']);
            $qty = (float) $line['quantity'];
            $cost = (float) $line['unit_cost'];
            PurchaseItem::query()->create([
                'purchase_id' => $purchase->id,
                'inventory_item_id' => $item->id,
                'quantity' => $qty,
                'quantity_received' => 0,
                'unit' => $line['unit'] ?? $item->unit,
                'unit_cost' => $cost,
                'total' => number_format($qty * $cost, 2, '.', ''),
            ]);
        }
    }
}
