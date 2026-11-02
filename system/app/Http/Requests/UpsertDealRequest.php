<?php

namespace App\Http\Requests;

use App\Models\DishVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpsertDealRequest extends FormRequest
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
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'is_active' => ['required', 'boolean'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.dish_id' => ['required', 'integer', 'exists:dishes,id'],
            'items.*.dish_variant_id' => ['nullable', 'integer', 'exists:dish_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach ($this->input('items', []) as $index => $item) {
                    if (empty($item['dish_variant_id'])) {
                        continue;
                    }
                    $belongs = DishVariant::query()
                        ->whereKey($item['dish_variant_id'])
                        ->where('dish_id', $item['dish_id'] ?? 0)
                        ->exists();
                    if (! $belongs) {
                        $validator->errors()->add("items.$index.dish_variant_id", 'This size does not belong to the selected product.');
                    }
                }
            },
        ];
    }
}
