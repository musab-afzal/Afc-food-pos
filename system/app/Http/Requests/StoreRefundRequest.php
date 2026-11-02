<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('pos.refund') ?? false;
    }

    protected function prepareForValidation(): void
    {
        // Allow POST sales/{sale}/refunds without repeating sale_id in the body.
        if ($this->route('sale') && ! $this->has('sale_id')) {
            $sale = $this->route('sale');
            $this->merge(['sale_id' => is_object($sale) ? $sale->getKey() : $sale]);
        }
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'sale_id' => ['required', 'integer', 'exists:sales,id'],
            'reason' => ['required', 'string', 'max:255'],
            'payment_method_id' => ['nullable', 'integer', 'exists:payment_methods,id'],
            'restore_inventory' => ['sometimes', 'boolean'],
            'items' => ['sometimes', 'nullable', 'array'],
            'items.*.sale_item_id' => ['required', 'integer', 'distinct', 'exists:sale_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
