<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpsertReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('tables.reservations') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'guests' => ['required', 'integer', 'min:1', 'max:100'],
            'reservation_date' => ['required', 'date'],
            'reservation_time' => ['required', 'date_format:H:i'],
            'restaurant_table_id' => ['nullable', 'integer', 'exists:restaurant_tables,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'special_request' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'in:pending,confirmed,arrived,seated,completed,no_show,cancelled'],
        ];
    }
}
