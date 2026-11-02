<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['uuid', 'order_number', 'customer_id', 'restaurant_table_id', 'created_by', 'source', 'order_type', 'status', 'payment_status', 'delivery_address', 'notes', 'subtotal', 'discount_total', 'tax_total', 'service_charge', 'delivery_charge', 'grand_total', 'ordered_at'])]
class Order extends Model
{
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(RestaurantTable::class, 'restaurant_table_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('id');
    }

    public function kitchenTickets(): HasMany
    {
        return $this->hasMany(KitchenTicket::class);
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function sale(): HasOne
    {
        return $this->hasOne(Sale::class);
    }

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'service_charge' => 'decimal:2',
            'delivery_charge' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'ordered_at' => 'datetime',
        ];
    }
}
