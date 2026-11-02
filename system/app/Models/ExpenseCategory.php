<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'is_active'])]
class ExpenseCategory extends Model
{
    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
