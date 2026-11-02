<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['refund_number', 'sale_id', 'user_id', 'payment_method_id', 'amount', 'reason', 'restore_inventory', 'refunded_at'])]
class Refund extends Model
{
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RefundItem::class);
    }

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'restore_inventory' => 'boolean', 'refunded_at' => 'datetime'];
    }
}
