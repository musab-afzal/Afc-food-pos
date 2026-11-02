<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        $permission = $this->isMethod('post') ? 'staff.create' : 'staff.edit';

        return $user->hasPermission($permission);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $staff = $this->route('staff');

        return [
            'employee_id' => ['required', 'string', 'max:50', Rule::unique('staff')->ignore($staff)],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('staff')->ignore($staff)],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:2000'],
            'emergency_contact' => ['nullable', 'string', 'max:150'],
            'designation' => ['nullable', 'string', 'max:100'],
            'joining_date' => ['required', 'date'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'employment_type' => ['nullable', 'string', 'max:30'],
            'shift' => ['nullable', 'string', 'max:50'],
            'status' => ['required', 'string', 'in:active,inactive,suspended,terminated,on_leave'],
            'profile_image' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'password' => [$this->isMethod('post') ? 'nullable' : 'nullable', 'string', 'min:8'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'employment_type' => $this->input('employment_type', 'full_time'),
            'salary' => $this->input('salary', 0),
        ]);
    }
}
