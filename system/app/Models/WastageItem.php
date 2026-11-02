<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['wastage_id', 'inventory_item_id', 'quantity', 'unit', 'unit_cost', 'total_cost'])]
class WastageItem extends Model
{
    public function wastage(): BelongsTo
    {
        return $this->belongsTo(Wastage::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:2',
        ];
    }
}
