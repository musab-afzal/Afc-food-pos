<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreHeldOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('pos.hold_order') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'uuid' => [$this->isMethod('post') ? 'required' : 'sometimes', 'uuid'],
            'payload' => ['required', 'array'],
            'order_type' => ['required', 'in:dine_in,takeaway,delivery'],
            'restaurant_table_id' => ['nullable', 'required_if:order_type,dine_in', 'exists:restaurant_tables,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
