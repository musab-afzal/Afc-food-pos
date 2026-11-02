<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'confirm_super_admin' => ['sometimes', 'boolean'],
        ];
    }
}
