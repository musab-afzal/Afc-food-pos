<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertRecipeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('recipes.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $recipe = $this->route('recipe');

        return [
            'dish_id' => [
                'required',
                'integer',
                'exists:dishes,id',
                Rule::unique('recipes', 'dish_id')
                    ->ignore($recipe)
                    ->where(fn ($query) => $query->where('dish_variant_id', $this->input('dish_variant_id'))),
            ],
            'dish_variant_id' => ['nullable', 'integer', 'exists:dish_variants,id'],
            'name' => ['nullable', 'string', 'max:150'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'integer', 'distinct', 'exists:inventory_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', 'string', 'max:30'],
            'items.*.wastage_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
