<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AssignDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return ($user?->hasPermission('orders.assign_rider') ?? false)
            || ($user?->hasPermission('riders.manage') ?? false);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'rider_id' => ['required', 'integer', 'exists:riders,id'],
            'address' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:30'],
            'delivery_charge' => ['nullable', 'numeric', 'min:0'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
