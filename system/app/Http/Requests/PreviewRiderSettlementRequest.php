<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PreviewRiderSettlementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('riders.view') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'rider_id' => ['required', 'integer', 'exists:riders,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
        ];
    }
}