<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('tables.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('restaurant_tables')->ignore($this->route('table'))->whereNull('deleted_at'),
            ],
            'table_number' => ['nullable', 'string', 'max:30'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:100'],
            'shape' => ['nullable', 'string', 'max:30'],
            'qr_token' => [
                'nullable',
                'uuid',
                Rule::unique('restaurant_tables', 'qr_token')->ignore($this->route('table'))->whereNull('deleted_at'),
            ],
            'status' => ['nullable', 'in:available,occupied,reserved,cleaning,disabled'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
