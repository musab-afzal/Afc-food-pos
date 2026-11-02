<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AssignShiftRequest extends FormRequest
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
        return [
            'staff_id' => ['required', 'integer', 'exists:staff,id,deleted_at,NULL'],
            'effective_from' => ['nullable', 'date'],
        ];
    }
}
