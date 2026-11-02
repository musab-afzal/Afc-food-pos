<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'discount_percent', 'description', 'is_active'])]
class CustomerGroup extends Model
{
    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    protected function casts(): array
    {
        return [
            'discount_percent' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
