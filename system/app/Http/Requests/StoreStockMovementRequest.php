<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreStockMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('inventory.adjust') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isStockIn = str_contains($this->path(), 'stock-in');

        return [
            'inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit_cost' => [$isStockIn ? 'nullable' : 'prohibited', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
