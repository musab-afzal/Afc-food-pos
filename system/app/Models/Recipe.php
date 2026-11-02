<?php

namespace App\Models;

use Database\Factories\RecipeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['dish_id', 'dish_variant_id', 'name'])]
class Recipe extends Model
{
    /** @use HasFactory<RecipeFactory> */
    use HasFactory;

    public function dish(): BelongsTo
    {
        return $this->belongsTo(Dish::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(DishVariant::class, 'dish_variant_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecipeItem::class);
    }
}
