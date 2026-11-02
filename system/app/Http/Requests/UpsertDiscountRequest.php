<?php

namespace App\Http\Requests;

use App\Models\Discount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertDiscountRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->hasPermission('discounts.manage') || $user->hasPermission('promotions.manage'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';
        $current = $this->route('discount');
        $type = $this->input('type', $current instanceof Discount ? $current->type : null);

        return [
            'name' => [$required, 'string', 'max:255'],
            'type' => [$required, Rule::in(Discount::TYPES)],
            'value' => [$required, 'numeric', 'gt:0', $type === 'percent' ? 'max:100' : 'max:9999999999.9999'],
            'applies_to' => ['sometimes', Rule::in(Discount::APPLIES_TO)],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'min_order' => ['nullable', 'numeric', 'min:0', 'max:999999999999.99'],
            'max_discount' => ['nullable', 'numeric', 'gt:0', 'max:999999999999.99'],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:4294967295'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, mixed> */
    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated($key, $default);

        if ($key === null && $this->isMethod('POST')) {
            $data['applies_to'] ??= 'order';
            $data['min_order'] ??= 0;
            $data['is_active'] ??= true;
        } elseif ($key === null && array_key_exists('min_order', $data)) {
            $data['min_order'] ??= 0;
        }

        return $data;
    }
}
