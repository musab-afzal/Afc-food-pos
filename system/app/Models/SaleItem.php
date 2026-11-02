<?php

namespace App\Models;

use Database\Factories\SaleItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['sale_id', 'dish_id', 'dish_variant_id', 'deal_id', 'deal_name', 'dish_name', 'sku', 'variant_name', 'quantity', 'unit_price', 'unit_cost', 'discount', 'tax', 'total', 'notes'])]
class SaleItem extends Model
{
    /** @use HasFactory<SaleItemFactory> */
    use HasFactory;

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function refundItems(): HasMany
    {
        return $this->hasMany(RefundItem::class);
    }

    public function addons(): HasMany
    {
        return $this->hasMany(SaleItemAddon::class);
    }

    protected function casts(): array
    {
        return ['unit_price' => 'decimal:2', 'unit_cost' => 'decimal:4', 'discount' => 'decimal:2', 'tax' => 'decimal:2', 'total' => 'decimal:2'];
    }
}
