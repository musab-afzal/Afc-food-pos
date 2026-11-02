<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'code', 'type', 'opening_balance', 'current_balance', 'is_active'])]
class Account extends Model
{
    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class);
    }

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'current_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
