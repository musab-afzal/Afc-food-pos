<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SettleRiderSettlementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('riders.settle') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'paid_to_restaurant' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
        ];
    }
}