<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** Shared by attendance check-in and check-out. */
class AttendanceClockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('attendance.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Defaults to the staff profile linked to the authenticated user.
            'staff_id' => ['nullable', 'integer', 'exists:staff,id,deleted_at,NULL'],
            // Optional back-dated timestamp; defaults to now.
            'at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
