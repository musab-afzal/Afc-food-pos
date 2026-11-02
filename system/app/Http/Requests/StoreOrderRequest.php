<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('orders.create') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'uuid'],
            'order_type' => ['required', 'in:dine_in,takeaway,delivery'],
            'restaurant_table_id' => ['nullable', 'required_if:order_type,dine_in', 'exists:restaurant_tables,id'],
            'customer_id' => ['nullable', 'exists:customers,id'],
            'source' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', 'in:draft,pending,confirmed'],
            'delivery_address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'discount_total' => ['sometimes', 'numeric', 'min:0'],
            'service_charge' => ['sometimes', 'numeric', 'min:0'],
            'delivery_charge' => ['sometimes', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.dish_id' => ['required', 'integer', 'exists:dishes,id'],
            'items.*.dish_variant_id' => ['nullable', 'integer', 'exists:dish_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.discount' => ['sometimes', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.addon_ids' => ['sometimes', 'array'],
            'items.*.addon_ids.*' => ['integer', 'distinct', 'exists:addons,id'],
        ];
    }
}
