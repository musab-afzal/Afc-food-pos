<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['order_id', 'customer_id', 'address', 'phone', 'rider_id', 'delivery_charge', 'cod_amount', 'status', 'assigned_at', 'picked_up_at', 'on_the_way_at', 'delivered_at', 'failed_at', 'failure_reason'])]
class Delivery extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ASSIGNED = 'assigned';

    public const STATUS_PICKED_UP = 'picked_up';

    public const STATUS_ON_THE_WAY = 'on_the_way';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [
            self::STATUS_PENDING,
            self::STATUS_ASSIGNED,
            self::STATUS_PICKED_UP,
            self::STATUS_ON_THE_WAY,
        ]);
    }

    protected function casts(): array
    {
        return [
            'delivery_charge' => 'decimal:2',
            'cod_amount' => 'decimal:2',
            'assigned_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'on_the_way_at' => 'datetime',
            'delivered_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
