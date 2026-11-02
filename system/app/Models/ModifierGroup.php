<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'is_required', 'min_selections', 'max_selections', 'is_active'])]
class ModifierGroup extends Model
{
    public function modifiers(): HasMany
    {
        return $this->hasMany(Modifier::class)->orderBy('sort_order');
    }

    public function dishes(): BelongsToMany
    {
        return $this->belongsToMany(Dish::class, 'dish_modifier_group');
    }

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
