<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'logo', 'description', 'is_active'])]
class Brand extends Model
{
    use SoftDeletes;

    public function dishes(): HasMany
    {
        return $this->hasMany(Dish::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
