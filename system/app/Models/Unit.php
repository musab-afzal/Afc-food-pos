<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'short_name', 'type', 'base_unit_id', 'conversion_factor', 'is_active'])]
class Unit extends Model
{
    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(self::class, 'base_unit_id');
    }

    public function derivedUnits(): HasMany
    {
        return $this->hasMany(self::class, 'base_unit_id');
    }

    protected function casts(): array
    {
        return [
            'conversion_factor' => 'decimal:6',
            'is_active' => 'boolean',
        ];
    }
}
