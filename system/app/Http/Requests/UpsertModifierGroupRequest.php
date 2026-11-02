<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpsertModifierGroupRequest extends FormRequest
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
            'is_required' => ['required', 'boolean'],
            'min_selections' => ['required', 'integer', 'min:0', 'max:50'],
            'max_selections' => ['nullable', 'integer', 'min:0', 'max:50'],
            'is_active' => ['required', 'boolean'],
            'dish_ids' => ['sometimes', 'array'],
            'dish_ids.*' => ['integer', 'exists:dishes,id'],
            'modifiers' => ['sometimes', 'array'],
            'modifiers.*.id' => ['nullable', 'integer', 'exists:modifiers,id'],
            'modifiers.*.name' => ['required', 'string', 'max:150'],
            'modifiers.*.additional_price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'modifiers.*.additional_cost' => ['nullable', 'numeric', 'min:0', 'max:999999999999.9999'],
            'modifiers.*.is_active' => ['required', 'boolean'],
            'modifiers.*.sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $min = (int) $this->input('min_selections', 0);
            $max = $this->input('max_selections');

            if ($max !== null && $max !== '' && (int) $max < $min) {
                $validator->errors()->add('max_selections', 'Max selections must be greater than or equal to min selections.');
            }

            if ($this->boolean('is_required') && $min < 1) {
                $validator->errors()->add('min_selections', 'Required groups must allow at least one selection.');
            }
        });
    }
}
