<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        $permission = $this->isMethod('post') ? 'inventory.create' : 'inventory.edit';

        return $this->user()?->hasPermission($permission) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'short_name' => [
                'required',
                'string',
                'max:30',
                Rule::unique('units', 'short_name')->ignore($this->route('unit')),
            ],
            'type' => ['required', 'string', Rule::in(['count', 'weight', 'volume', 'length', 'other'])],
            'base_unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'conversion_factor' => ['required', 'numeric', 'min:0.000001'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
