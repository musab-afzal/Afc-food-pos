<?php

namespace App\Models;

use Database\Factories\DishFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['category_id', 'brand_id', 'name', 'slug', 'sku', 'barcode', 'description', 'short_description', 'image', 'base_price', 'tax_percent', 'preparation_minutes', 'is_active', 'is_available', 'dine_in_enabled', 'takeaway_enabled', 'delivery_enabled', 'qr_enabled', 'pos_enabled', 'kitchen_enabled', 'sort_order'])]
class Dish extends Model
{
    /** @use HasFactory<DishFactory> */
    use HasFactory, SoftDeletes;

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(DishVariant::class);
    }

    public function addons(): BelongsToMany
    {
        return $this->belongsToMany(Addon::class);
    }

    public function modifierGroups(): BelongsToMany
    {
        return $this->belongsToMany(ModifierGroup::class, 'dish_modifier_group');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function recipe(): HasOne
    {
        return $this->hasOne(Recipe::class)->whereNull('dish_variant_id');
    }

    /** Public URL for the dish image (root-relative so it works across local hosts/ports). */
    public function imageUrl(): ?string
    {
        $image = trim((string) $this->image);
        if ($image === '') {
            return null;
        }
        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://') || str_starts_with($image, 'data:')) {
            return $image;
        }
        if (str_starts_with($image, '/storage/')) {
            return $image;
        }
        if (str_starts_with($image, 'storage/')) {
            return '/'.$image;
        }

        return '/storage/'.ltrim($image, '/');
    }

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2', 'tax_percent' => 'decimal:2', 'is_active' => 'boolean',
            'is_available' => 'boolean', 'dine_in_enabled' => 'boolean', 'takeaway_enabled' => 'boolean',
            'delivery_enabled' => 'boolean', 'qr_enabled' => 'boolean', 'pos_enabled' => 'boolean',
            'kitchen_enabled' => 'boolean',
        ];
    }
}
