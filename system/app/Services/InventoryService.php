<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\StockAdjustment;
use App\Models\User;
use App\Models\Wastage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function __construct(
        private readonly SettingsService $settings,
    ) {}

    public function adjustStock(
        InventoryItem $item,
        float $quantityChange,
        string $type,
        ?User $user = null,
        ?string $notes = null,
        ?Model $reference = null,
        ?float $unitCost = null,
    ): InventoryMovement {
        if (! in_array($type, InventoryMovement::TYPES, true)) {
            throw ValidationException::withMessages(['type' => ["Invalid movement type: {$type}."]]);
        }

        $locked = InventoryItem::query()->lockForUpdate()->findOrFail($item->id);
        $before = (float) $locked->current_stock;
        $after = $before + $quantityChange;

        if ($after < 0 && ! $this->settings->get('inventory.allow_negative_stock', false)) {
            throw ValidationException::withMessages([
                'quantity' => ["Insufficient stock for {$locked->name}. Available: {$before}."],
            ]);
        }

        $cost = $unitCost ?? (float) $locked->average_cost;

        if ($quantityChange > 0 && $unitCost !== null && $unitCost >= 0) {
            $newAverage = $after > 0
                ? (($before * (float) $locked->average_cost) + ($quantityChange * $unitCost)) / $after
                : $unitCost;
            $locked->update([
                'current_stock' => $after,
                'average_cost' => round($newAverage, 4),
                'latest_purchase_cost' => $unitCost,
            ]);
        } else {
            $locked->update(['current_stock' => $after]);
        }

        app(LowStockNotifier::class)->check($locked, $before, $after);

        return InventoryMovement::query()->create([
            'inventory_item_id' => $locked->id,
            'user_id' => $user?->id,
            'type' => $type,
            'quantity' => $quantityChange,
            'before_quantity' => $before,
            'after_quantity' => $after,
            'unit_cost' => $cost,
            'reference_type' => $reference?->getMorphClass(),
            'reference_id' => $reference?->getKey(),
            'notes' => $notes,
            'occurred_at' => now(),
        ]);
    }

    /**
     * @param  array{
     *     type: string,
     *     reason: string,
     *     notes?: string|null,
     *     adjustment_date?: string|null,
     *     items: list<array{inventory_item_id: int, quantity: float|int|string, unit: string, unit_cost?: float|int|string|null}>
     * }  $payload
     */
    public function createAdjustment(User $user, array $payload): StockAdjustment
    {
        return DB::transaction(function () use ($user, $payload): StockAdjustment {
            $type = $payload['type'];
            if (! in_array($type, ['increase', 'decrease'], true)) {
                throw ValidationException::withMessages(['type' => ['Adjustment type must be increase or decrease.']]);
            }

            $adjustment = StockAdjustment::query()->create([
                'adjustment_number' => 'PENDING',
                'user_id' => $user->id,
                'type' => $type,
                'reason' => $payload['reason'],
                'notes' => $payload['notes'] ?? null,
                'adjustment_date' => $payload['adjustment_date'] ?? now()->toDateString(),
            ]);
            $adjustment->update([
                'adjustment_number' => sprintf('ADJ-%s-%06d', now()->format('Y'), $adjustment->id),
            ]);

            foreach ($payload['items'] as $line) {
                $quantity = abs((float) $line['quantity']);
                if ($quantity <= 0) {
                    throw ValidationException::withMessages(['items' => ['Each adjustment item quantity must be greater than zero.']]);
                }

                $item = InventoryItem::query()->findOrFail($line['inventory_item_id']);
                $signed = $type === 'increase' ? $quantity : -$quantity;
                $unitCost = isset($line['unit_cost']) ? (float) $line['unit_cost'] : null;

                $adjustment->items()->create([
                    'inventory_item_id' => $item->id,
                    'quantity' => $quantity,
                    'unit' => $line['unit'],
                    'unit_cost' => $unitCost ?? (float) $item->average_cost,
                ]);

                $this->adjustStock(
                    $item,
                    $signed,
                    'manual_adjustment',
                    $user,
                    $payload['reason'],
                    $adjustment,
                    $type === 'increase' ? $unitCost : null,
                );
            }

            return $adjustment->fresh(['items.inventoryItem', 'user']);
        });
    }

    /**
     * @param  array{
     *     reason: string,
     *     notes?: string|null,
     *     wastage_date?: string|null,
     *     items: list<array{inventory_item_id: int, quantity: float|int|string, unit: string, unit_cost?: float|int|string|null}>
     * }  $payload
     */
    public function createWastage(User $user, array $payload): Wastage
    {
        return DB::transaction(function () use ($user, $payload): Wastage {
            $wastage = Wastage::query()->create([
                'wastage_number' => 'PENDING',
                'user_id' => $user->id,
                'reason' => $payload['reason'],
                'total_cost' => 0,
                'wastage_date' => $payload['wastage_date'] ?? now()->toDateString(),
                'notes' => $payload['notes'] ?? null,
            ]);
            $wastage->update([
                'wastage_number' => sprintf('WST-%s-%06d', now()->format('Y'), $wastage->id),
            ]);

            $totalCost = 0.0;

            foreach ($payload['items'] as $line) {
                $quantity = abs((float) $line['quantity']);
                if ($quantity <= 0) {
                    throw ValidationException::withMessages(['items' => ['Each wastage item quantity must be greater than zero.']]);
                }

                $item = InventoryItem::query()->findOrFail($line['inventory_item_id']);
                $unitCost = isset($line['unit_cost']) ? (float) $line['unit_cost'] : (float) $item->average_cost;
                $lineTotal = round($quantity * $unitCost, 2);
                $totalCost += $lineTotal;

                $wastage->items()->create([
                    'inventory_item_id' => $item->id,
                    'quantity' => $quantity,
                    'unit' => $line['unit'],
                    'unit_cost' => $unitCost,
                    'total_cost' => $lineTotal,
                ]);

                $this->adjustStock(
                    $item,
                    -$quantity,
                    'waste',
                    $user,
                    $payload['reason'],
                    $wastage,
                    $unitCost,
                );
            }

            $wastage->update(['total_cost' => round($totalCost, 2)]);

            return $wastage->fresh(['items.inventoryItem', 'user']);
        });
    }
}
