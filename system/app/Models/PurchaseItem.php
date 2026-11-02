<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['purchase_id', 'inventory_item_id', 'quantity', 'quantity_received', 'unit', 'unit_cost', 'total'])]
class PurchaseItem extends Model
{
    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function receiptItems(): HasMany
    {
        return $this->hasMany(PurchaseReceiptItem::class);
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'quantity_received' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total' => 'decimal:2',
        ];
    }
}
