<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustLoyaltyRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->hasPermission('loyalty.manage') || $user->hasPermission('customers.loyalty'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'points' => ['required', 'integer', 'not_in:0', 'between:-1000000,1000000'],
            'notes' => ['required', 'string', 'max:1000'],
        ];
    }
}
