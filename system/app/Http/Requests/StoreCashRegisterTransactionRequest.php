<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCashRegisterTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('finance.cash_register') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(['cash_in', 'cash_out'])],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999.99'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
