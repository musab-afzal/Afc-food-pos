<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePosSaleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('pos.create_sale') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        // Unpaid / pending sales may carry no payments (or zero-amount ones) and are settled later.
        $deferred = in_array($this->input('payment_status'), ['unpaid', 'pending'], true);

        return [
            'payment_status' => ['nullable', 'in:paid,unpaid,pending'],
            'delivery_name' => ['nullable', 'string', 'max:150'],
            'delivery_address' => ['nullable', 'string', 'max:1000'],
            'delivery_phone' => ['nullable', 'string', 'max:30'],
            'processing_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'custom_slip_message' => ['nullable', 'string', 'max:500'],
            'uuid' => ['required', 'uuid'],
            'order_type' => ['required', 'in:dine_in,takeaway,delivery'],
            'restaurant_table_id' => ['nullable', 'required_if:order_type,dine_in', 'exists:restaurant_tables,id'],
            'customer_id' => [
                $deferred ? 'required' : 'nullable',
                'exists:customers,id',
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
            'was_offline' => ['sometimes', 'boolean'],
            'discount_total' => ['sometimes', 'numeric', 'min:0'],
            // service_charge / delivery_charge are accepted for backwards compatibility but ignored: charges are computed server-side.
            'service_charge' => ['sometimes', 'numeric', 'min:0'],
            'delivery_charge' => ['sometimes', 'numeric', 'min:0'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'loyalty_points' => ['nullable', 'integer', 'min:0'],
            'items' => ['required_without:deals', 'array'],
            'deals' => ['required_without:items', 'array'],
            'deals.*.deal_id' => ['required', 'integer', 'exists:deals,id'],
            'deals.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'deals.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.dish_id' => ['required', 'integer', 'exists:dishes,id'],
            'items.*.dish_variant_id' => ['nullable', 'integer', 'exists:dish_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.discount' => ['sometimes', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.addon_ids' => ['sometimes', 'array'],
            'items.*.addon_ids.*' => ['integer', 'distinct', 'exists:addons,id'],
            'items.*.removed_ingredient_ids' => ['sometimes', 'array'],
            'items.*.removed_ingredient_ids.*' => ['integer', 'distinct', 'exists:inventory_items,id'],
            'payments' => $deferred
                ? ['required_unless:payment_status,unpaid,pending', 'nullable', 'array']
                : ['required_unless:payment_status,unpaid,pending', 'array', 'min:1'],
            'payments.*.payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payments.*.amount' => $deferred ? ['required', 'numeric', 'min:0'] : ['required', 'numeric', 'gt:0'],
            'payments.*.reference' => ['nullable', 'string', 'max:150'],
        ];
    }
}
