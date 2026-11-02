<?php

namespace App\Models;

use Database\Factories\InventoryCategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'description', 'is_active'])]
class InventoryCategory extends Model
{
    /** @use HasFactory<InventoryCategoryFactory> */
    use HasFactory, SoftDeletes;

    public function items(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
