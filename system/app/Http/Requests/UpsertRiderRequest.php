<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertRiderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('riders.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $riderId = $this->route('rider')?->id;

        return [
            'staff_id' => [
                'nullable',
                'integer',
                Rule::unique('riders', 'staff_id')->ignore($riderId)->whereNull('deleted_at'),
                'exists:staff,id',
            ],
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'vehicle_number' => ['nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'in:available,busy,offline'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
