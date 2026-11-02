<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpsertPurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        return $this->isMethod('post')
            ? $user->hasPermission('purchases.create')
            : $user->hasPermission('purchases.edit');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'purchase_date' => ['nullable', 'date'],
            'invoice_reference' => ['nullable', 'string', 'max:150'],
            'discount' => ['sometimes', 'numeric', 'min:0'],
            'tax' => ['sometimes', 'numeric', 'min:0'],
            'other_charges' => ['sometimes', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['nullable', 'string', 'max:30'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ];
    }
}
