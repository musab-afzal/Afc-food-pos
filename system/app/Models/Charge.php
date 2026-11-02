<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'code', 'type', 'value', 'is_active', 'apply_to'])]
class Charge extends Model
{
    protected function casts(): array
    {
        return [
            'value' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }
}
