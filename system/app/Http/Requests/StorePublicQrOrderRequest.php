<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePublicQrOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'guest_name' => ['nullable', 'string', 'max:150'],
            'guest_phone' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.dish_id' => ['required', 'integer', 'exists:dishes,id'],
            'items.*.dish_variant_id' => ['nullable', 'integer', 'exists:dish_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.addon_ids' => ['sometimes', 'array'],
            'items.*.addon_ids.*' => ['integer', 'distinct', 'exists:addons,id'],
        ];
    }
}
