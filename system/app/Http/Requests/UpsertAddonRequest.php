<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpsertAddonRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:999999999999.9999'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
