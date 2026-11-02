<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $role = $this->route('role');

        return [
            'name' => ['required', 'string', 'max:100', Rule::unique('roles', 'name')->ignore($role)],
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('roles', 'slug')->ignore($role)],
            'description' => ['nullable', 'string', 'max:500'],
            'max_discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['required', 'boolean'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('name') && ! $this->filled('slug')) {
            $this->merge([
                'slug' => str($this->input('name'))->slug('_')->toString(),
            ]);
        }

        if ($this->filled('name')) {
            $this->merge(['name' => trim((string) $this->input('name'))]);
        }
    }
}
