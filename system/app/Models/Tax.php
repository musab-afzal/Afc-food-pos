<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'percentage', 'is_inclusive', 'is_active'])]
class Tax extends Model
{
    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:4',
            'is_inclusive' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
