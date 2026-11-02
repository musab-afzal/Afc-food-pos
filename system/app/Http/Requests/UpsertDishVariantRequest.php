<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertDishVariantRequest extends FormRequest
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
        $dish = $this->route('dish');
        $variant = $this->route('variant');

        return [
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('dish_variants')->where(fn ($query) => $query->where('dish_id', $dish?->id))->ignore($variant),
            ],
            'sku' => ['required', 'string', 'max:100', Rule::unique('dish_variants')->ignore($variant)],
            'price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
