<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['rider_id', 'settlement_number', 'period_start', 'period_end', 'total_cod', 'commission', 'paid_to_restaurant', 'balance', 'status', 'settled_at', 'created_by', 'notes'])]
class RiderSettlement extends Model
{
    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'total_cod' => 'decimal:2',
            'commission' => 'decimal:2',
            'paid_to_restaurant' => 'decimal:2',
            'balance' => 'decimal:2',
            'settled_at' => 'datetime',
        ];
    }
}
