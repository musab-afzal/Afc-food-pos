<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'contact_person', 'phone', 'email', 'address', 'opening_balance', 'current_payable', 'is_active', 'notes'])]
class Supplier extends Model
{
    use SoftDeletes;

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'current_payable' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
