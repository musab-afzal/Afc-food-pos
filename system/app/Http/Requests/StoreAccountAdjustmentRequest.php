<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAccountAdjustmentRequest extends FormRequest
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
        return [
            'direction' => ['required', 'string', Rule::in(['increase', 'decrease'])],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999.99'],
            'reason' => ['required', 'string', 'max:2000'],
            'date' => ['nullable', 'date'],
        ];
    }
}
