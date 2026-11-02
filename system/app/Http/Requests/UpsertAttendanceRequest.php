<?php

namespace App\Http\Requests;

use App\Services\AttendanceService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Manual attendance entry: POST attendance (upsert by staff + date) and PUT attendance/{attendance}. */
class UpsertAttendanceRequest extends FormRequest
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
        $required = $this->route('attendance') ? 'sometimes' : 'required';

        return [
            'staff_id' => [$required, 'integer', 'exists:staff,id,deleted_at,NULL'],
            'date' => [$required, 'date'],
            'check_in' => ['nullable', 'date'],
            'check_out' => ['nullable', 'date', 'after_or_equal:check_in'],
            'status' => ['nullable', 'string', Rule::in(AttendanceService::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
