<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('staff.edit') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:100', Rule::unique('shifts', 'name')->ignore($this->route('shift'))],
            'start_time' => [$required, 'date_format:H:i'],
            'end_time' => [$required, 'date_format:H:i'],
            'grace_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
