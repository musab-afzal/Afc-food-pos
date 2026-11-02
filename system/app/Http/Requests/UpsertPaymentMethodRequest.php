<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertPaymentMethodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('finance.payment') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $method = $this->route('paymentMethod');
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:100'],
            'code' => [$required, 'string', 'max:50', 'alpha_dash:ascii', Rule::unique('payment_methods', 'code')->ignore($method?->id)],
            'icon' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'requires_reference' => ['sometimes', 'boolean'],
            'works_offline' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
