<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertInventoryCategoryRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('inventory_categories', 'name')->ignore($this->route('inventoryCategory'))->whereNull('deleted_at'),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
