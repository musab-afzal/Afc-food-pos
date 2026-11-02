<?php

namespace App\Models;

use Database\Factories\AddonFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'price', 'cost', 'is_active'])]
class Addon extends Model
{
    /** @use HasFactory<AddonFactory> */
    use HasFactory;

    public function dishes(): BelongsToMany
    {
        return $this->belongsToMany(Dish::class);
    }

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'cost' => 'decimal:4', 'is_active' => 'boolean'];
    }
}
