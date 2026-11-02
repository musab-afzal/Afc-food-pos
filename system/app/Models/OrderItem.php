<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['order_id', 'dish_id', 'dish_variant_id', 'deal_id', 'deal_name', 'dish_name', 'variant_name', 'quantity', 'unit_price', 'discount', 'tax', 'total', 'notes', 'kitchen_status'])]
class OrderItem extends Model
{
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function dish(): BelongsTo
    {
        return $this->belongsTo(Dish::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(DishVariant::class, 'dish_variant_id');
    }

    public function addons(): HasMany
    {
        return $this->hasMany(OrderItemAddon::class);
    }

    public function kitchenTicketItems(): HasMany
    {
        return $this->hasMany(KitchenTicketItem::class);
    }

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }
}
