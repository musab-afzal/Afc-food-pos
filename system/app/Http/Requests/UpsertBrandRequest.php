<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertBrandRequest extends FormRequest
{
    public function authorize(): bool
    {
        $permission = $this->isMethod('post') ? 'menu.create' : 'menu.edit';

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
                Rule::unique('brands')->ignore($this->route('brand'))->whereNull('deleted_at'),
            ],
            'logo' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
