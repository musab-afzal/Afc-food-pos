<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertIncomeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('finance.income') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'category' => [$required, 'string', 'max:150'],
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')->where('is_active', true)],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'amount' => [$required, 'numeric', 'gt:0', 'max:999999999999.99'],
            'income_date' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
