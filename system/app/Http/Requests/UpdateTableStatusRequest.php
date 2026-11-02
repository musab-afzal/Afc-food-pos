<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTableStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('tables.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'in:available,occupied,reserved,cleaning,disabled'],
        ];
    }
}
