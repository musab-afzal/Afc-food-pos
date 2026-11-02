<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertChargeRequest extends FormRequest
{
    public const APPLY_TO = ['all', 'dine_in', 'takeaway', 'delivery'];

    public function authorize(): bool
    {
        return $this->user()?->hasPermission('settings.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'max:50', 'alpha_dash:ascii', Rule::unique('charges', 'code')->ignore($this->route('charge'))],
            // "percentage" is accepted as a legacy alias (older seed data) and stored as "percent".
            'type' => [$required, 'in:fixed,percent,percentage'],
            'value' => [$required, 'numeric', 'min:0', 'max:9999999999'],
            'apply_to' => ['sometimes', Rule::in(self::APPLY_TO)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    protected function after(): array
    {
        return [function ($validator): void {
            $type = $this->input('type', $this->route('charge')?->type);
            $value = $this->input('value', $this->route('charge')?->value);
            if (in_array($type, ['percent', 'percentage'], true) && is_numeric($value) && (float) $value > 100) {
                $validator->errors()->add('value', 'A percent charge may not exceed 100.');
            }
        }];
    }
}
