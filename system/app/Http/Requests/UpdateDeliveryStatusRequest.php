<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateDeliveryStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return ($user?->hasPermission('riders.manage') ?? false)
            || ($user?->hasPermission('orders.update') ?? false);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'in:pending,assigned,picked_up,on_the_way,delivered,failed,cancelled'],
            'failure_reason' => ['nullable', 'required_if:status,failed', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
