<?php

namespace App\Models;

use Database\Factories\DishVariantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['dish_id', 'name', 'sku', 'price', 'is_active', 'sort_order'])]
class DishVariant extends Model
{
    /** @use HasFactory<DishVariantFactory> */
    use HasFactory;

    public function dish(): BelongsTo
    {
        return $this->belongsTo(Dish::class);
    }

    public function recipe(): HasOne
    {
        return $this->hasOne(Recipe::class);
    }

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'is_active' => 'boolean'];
    }
}
