<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['sale_item_id', 'addon_id', 'name', 'price', 'quantity', 'total'])]
class SaleItemAddon extends Model
{
    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class);
    }

    public function addon(): BelongsTo
    {
        return $this->belongsTo(Addon::class);
    }

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }
}
