<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['deal_id', 'dish_id', 'dish_variant_id', 'quantity'])]
class DealItem extends Model
{
    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function dish(): BelongsTo
    {
        return $this->belongsTo(Dish::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(DishVariant::class, 'dish_variant_id');
    }

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }
}
