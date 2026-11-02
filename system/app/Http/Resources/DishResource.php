<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DishResource extends JsonResource
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
            'category_id' => $this->category_id,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'brand_id' => $this->brand_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'description' => $this->description,
            'short_description' => $this->short_description,
            'image' => $this->image,
            'base_price' => $this->base_price,
            'tax_percent' => $this->tax_percent,
            'preparation_minutes' => $this->preparation_minutes,
            'is_active' => $this->is_active,
            'is_available' => $this->is_available,
            'dine_in_enabled' => $this->dine_in_enabled,
            'takeaway_enabled' => $this->takeaway_enabled,
            'delivery_enabled' => $this->delivery_enabled,
            'qr_enabled' => $this->qr_enabled,
            'pos_enabled' => $this->pos_enabled,
            'kitchen_enabled' => $this->kitchen_enabled,
            'sort_order' => $this->sort_order,
            'variants' => $this->whenLoaded('variants'),
            'addons' => $this->whenLoaded('addons'),
            'modifier_groups' => $this->whenLoaded('modifierGroups'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
