<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertInventoryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $permission = $this->isMethod('post') ? 'inventory.create' : 'inventory.edit';

        return $this->user()?->hasPermission($permission) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $item = $this->route('inventoryItem');

        return [
            'inventory_category_id' => ['required', 'integer', 'exists:inventory_categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'preferred_supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'name' => ['required', 'string', 'max:200'],
            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('inventory_items', 'sku')->ignore($item)->whereNull('deleted_at'),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('inventory_items', 'barcode')->ignore($item)->whereNull('deleted_at'),
            ],
            'unit' => ['required', 'string', 'max:30'],
            'current_stock' => [$this->isMethod('post') ? 'nullable' : 'prohibited', 'numeric'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'average_cost' => ['nullable', 'numeric', 'min:0'],
            'latest_purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'auto_minus' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
