<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('finance.accounts') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $account = $this->route('account');
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'max:50', Rule::unique('accounts', 'code')->ignore($account?->id)],
            'type' => ['sometimes', 'string', Rule::in(['cash', 'bank', 'wallet', 'other'])],
            'opening_balance' => ['sometimes', 'numeric', 'min:-999999999999.99', 'max:999999999999.99'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
