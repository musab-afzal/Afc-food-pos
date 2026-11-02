<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['modifier_group_id', 'name', 'additional_price', 'additional_cost', 'is_active', 'sort_order'])]
class Modifier extends Model
{
    public function group(): BelongsTo
    {
        return $this->belongsTo(ModifierGroup::class, 'modifier_group_id');
    }

    protected function casts(): array
    {
        return [
            'additional_price' => 'decimal:2',
            'additional_cost' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }
}
