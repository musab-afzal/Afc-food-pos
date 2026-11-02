<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('orders.update') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'in:draft,pending,confirmed,preparing,ready,served,out_for_delivery,completed,cancelled,refunded,partially_refunded',
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
