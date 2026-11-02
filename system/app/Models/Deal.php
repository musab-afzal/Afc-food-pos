<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'description', 'price', 'is_active'])]
class Deal extends Model
{
    protected $appends = ['regular_price'];

    public function items(): HasMany
    {
        return $this->hasMany(DealItem::class);
    }

    /** Sum of the products' own menu prices, so staff can see what the deal saves. */
    public function getRegularPriceAttribute(): ?string
    {
        if (! $this->relationLoaded('items')) {
            return null;
        }

        $total = $this->items->sum(function (DealItem $item): float {
            $variant = $item->relationLoaded('variant') ? $item->variant : null;
            $dish = $item->relationLoaded('dish') ? $item->dish : null;
            $unit = $variant?->price ?? $dish?->base_price ?? 0;

            return (float) $unit * $item->quantity;
        });

        return number_format($total, 2, '.', '');
    }

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'is_active' => 'boolean'];
    }
}
