<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWastageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('inventory.wastage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:40', Rule::in([
                'spoilage', 'expiry', 'damage', 'theft', 'overproduction', 'other',
            ])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'wastage_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', 'string', 'max:30'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
