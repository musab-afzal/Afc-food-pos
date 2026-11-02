<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['order_item_id', 'addon_id', 'name', 'price', 'quantity', 'total'])]
class OrderItemAddon extends Model
{
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
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
