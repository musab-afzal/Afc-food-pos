<?php

namespace App\Http\Requests;

use App\Models\Coupon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->hasPermission('coupons.manage') || $user->hasPermission('promotions.manage'));
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';
        $current = $this->route('coupon');
        $type = $this->input('type', $current instanceof Coupon ? $current->type : null);

        return [
            'code' => [$required, 'string', 'min:3', 'max:50', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('coupons', 'code')->ignore($current instanceof Coupon ? $current->id : null)],
            'name' => [$required, 'string', 'max:255'],
            'type' => [$required, Rule::in(Coupon::TYPES)],
            'value' => [$required, 'numeric', 'gt:0', $type === 'percent' ? 'max:100' : 'max:9999999999.9999'],
            'min_order' => ['nullable', 'numeric', 'min:0', 'max:999999999999.99'],
            'max_discount' => ['nullable', 'numeric', 'gt:0', 'max:999999999999.99'],
            'start_date' => [$required, 'date_format:Y-m-d'],
            'expiry_date' => [$required, 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'total_usage_limit' => ['nullable', 'integer', 'min:1', 'max:4294967295'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1', 'max:4294967295'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['code.regex' => 'The coupon code may only contain letters, numbers, dashes and underscores.'];
    }

    /** @return array<string, mixed> */
    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated($key, $default);

        if ($key === null && $this->isMethod('POST')) {
            $data['min_order'] ??= 0;
            $data['is_active'] ??= true;
        } elseif ($key === null && array_key_exists('min_order', $data)) {
            $data['min_order'] ??= 0;
        }

        return $data;
    }
}
