<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertCustomerGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('customers.edit') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('customer_groups')->ignore($this->route('customerGroup')),
            ],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
