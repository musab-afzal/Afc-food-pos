<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['order_id', 'ticket_number', 'status', 'accepted_at', 'ready_at', 'completed_at'])]
class KitchenTicket extends Model
{
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(KitchenTicketItem::class);
    }

    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'ready_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
