<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PosCatalogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'description' => $this->short_description,
            'image' => $this->image,
            'price' => $this->base_price,
            'tax_percent' => $this->tax_percent,
            'preparation_minutes' => $this->preparation_minutes,
            'category_id' => $this->category_id,
            'is_available' => (bool) $this->is_available,
            'image_url' => $this->image,
            'has_variants' => $this->variants->isNotEmpty(),
            'has_addons' => $this->addons->isNotEmpty(),
            'ingredients' => $this->recipeIngredients($this->recipe),
            'variants' => $this->variants->map(fn ($variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price,
                'ingredients' => $this->recipeIngredients($variant->recipe),
            ]),
            'addons' => $this->addons->map(fn ($addon) => [
                'id' => $addon->id,
                'name' => $addon->name,
                'price' => $addon->price,
            ]),
        ];
    }

    /** Unique inventory items from a recipe for POS "remove ingredient" choices. */
    private function recipeIngredients($recipe): array
    {
        if (! $recipe) {
            return [];
        }

        return $recipe->items
            ->filter(fn ($item) => $item->inventoryItem && $item->inventoryItem->is_active !== false)
            ->unique('inventory_item_id')
            ->values()
            ->map(fn ($item) => [
                'id' => $item->inventory_item_id,
                'name' => $item->inventoryItem->name,
            ])
            ->all();
    }
}
