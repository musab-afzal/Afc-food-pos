<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreLeaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->hasPermission('attendance.manage') || $user->hasPermission('staff.edit'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Defaults to the staff profile linked to the authenticated user.
            'staff_id' => ['nullable', 'integer', 'exists:staff,id,deleted_at,NULL'],
            'leave_type' => ['required', 'string', 'max:40'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
