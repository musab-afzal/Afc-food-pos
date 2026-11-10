<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertDishRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $permission = $this->isMethod('post') ? 'menu.create' : 'menu.edit';

        return $this->user()?->hasPermission($permission) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'name' => ['required', 'string', 'max:180'],
            'slug' => ['required', 'string', 'max:200', Rule::unique('dishes')->ignore($this->route('dish'))],
            'sku' => ['required', 'string', 'max:100', Rule::unique('dishes')->ignore($this->route('dish'))],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('dishes')->ignore($this->route('dish'))],
            'description' => ['nullable', 'string', 'max:5000'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'string', 'max:1000'],
            'base_price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'tax_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'preparation_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'is_active' => ['required', 'boolean'],
            'is_available' => ['required', 'boolean'],
            'dine_in_enabled' => ['required', 'boolean'],
            'takeaway_enabled' => ['required', 'boolean'],
            'delivery_enabled' => ['required', 'boolean'],
            'qr_enabled' => ['required', 'boolean'],
            'pos_enabled' => ['required', 'boolean'],
            'kitchen_enabled' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
            'auto_minus_items' => ['sometimes', 'array'],
            'auto_minus_items.*.inventory_item_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('inventory_items', 'id')->where(fn ($query) => $query
                    ->where('auto_minus', true)
                    ->where('is_active', true)
                    ->whereNull('deleted_at')),
            ],
            'auto_minus_items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:999999'],
        ];
    }
}
