<?php

namespace App\Models;

use Database\Factories\RecipeItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['recipe_id', 'inventory_item_id', 'quantity', 'unit', 'wastage_percent'])]
class RecipeItem extends Model
{
    /** @use HasFactory<RecipeItemFactory> */
    use HasFactory;

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4', 'wastage_percent' => 'decimal:2'];
    }
}
