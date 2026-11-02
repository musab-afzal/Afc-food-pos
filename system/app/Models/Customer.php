<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['customer_code', 'customer_group_id', 'name', 'phone', 'alternate_mobile', 'email', 'date_of_birth', 'gender', 'address', 'city', 'loyalty_points', 'credit_limit', 'balance', 'is_active', 'notes'])]
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, SoftDeletes;

    public function group(): BelongsTo
    {
        return $this->belongsTo(CustomerGroup::class, 'customer_group_id');
    }

    public function loyaltyTransactions(): HasMany
    {
        return $this->hasMany(LoyaltyTransaction::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'loyalty_points' => 'integer',
            'credit_limit' => 'decimal:2',
            'balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
