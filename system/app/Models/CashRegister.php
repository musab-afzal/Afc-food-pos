<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'status', 'opening_amount', 'expected_closing', 'actual_closing', 'difference', 'opened_at', 'closed_at', 'notes'])]
class CashRegister extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CashRegisterTransaction::class);
    }

    protected function casts(): array
    {
        return [
            'opening_amount' => 'decimal:2',
            'expected_closing' => 'decimal:2',
            'actual_closing' => 'decimal:2',
            'difference' => 'decimal:2',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
