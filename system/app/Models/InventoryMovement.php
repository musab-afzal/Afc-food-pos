<?php

namespace App\Models;

use Database\Factories\InventoryMovementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['inventory_item_id', 'user_id', 'type', 'quantity', 'before_quantity', 'after_quantity', 'unit_cost', 'reference_type', 'reference_id', 'notes', 'occurred_at'])]
class InventoryMovement extends Model
{
    /** @use HasFactory<InventoryMovementFactory> */
    use HasFactory;

    public const TYPES = [
        'opening_stock',
        'purchase',
        'purchase_receipt',
        'sale_consumption',
        'manual_adjustment',
        'waste',
        'return',
        'purchase_return',
        'correction',
        'stock_in',
        'stock_out',
    ];

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'before_quantity' => 'decimal:4',
            'after_quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'occurred_at' => 'datetime',
        ];
    }
}
