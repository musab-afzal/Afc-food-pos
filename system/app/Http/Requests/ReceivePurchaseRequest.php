<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ReceivePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        return $user->hasPermission('purchases.approve') || $user->hasPermission('inventory.purchase');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:2000'],
            'received_at' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_item_id' => ['required', 'integer', 'exists:purchase_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ];
    }
}
