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
            'variants' => $this->variants->map(fn ($variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price,
            ]),
            'addons' => $this->addons->map(fn ($addon) => [
                'id' => $addon->id,
                'name' => $addon->name,
                'price' => $addon->price,
            ]),
        ];
    }
}
