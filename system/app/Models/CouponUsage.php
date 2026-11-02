<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['coupon_id', 'customer_id', 'order_id', 'sale_id', 'discount_amount', 'used_at'])]
class CouponUsage extends Model
{
    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    protected function casts(): array
    {
        return [
            'discount_amount' => 'decimal:2',
            'used_at' => 'datetime',
        ];
    }
}
