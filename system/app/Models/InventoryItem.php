<?php

namespace App\Models;

use Database\Factories\InventoryItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['inventory_category_id', 'brand_id', 'preferred_supplier_id', 'name', 'sku', 'barcode', 'unit', 'current_stock', 'minimum_stock', 'reorder_level', 'average_cost', 'latest_purchase_cost', 'is_active', 'auto_minus', 'notes'])]
class InventoryItem extends Model
{
    /** @use HasFactory<InventoryItemFactory> */
    use HasFactory, SoftDeletes;

    public function category(): BelongsTo
    {
        return $this->belongsTo(InventoryCategory::class, 'inventory_category_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function preferredSupplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'preferred_supplier_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:4',
            'minimum_stock' => 'decimal:4',
            'reorder_level' => 'decimal:4',
            'average_cost' => 'decimal:4',
            'latest_purchase_cost' => 'decimal:4',
            'is_active' => 'boolean',
            'auto_minus' => 'boolean',
        ];
    }
}
