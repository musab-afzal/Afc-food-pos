<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('expenses.manage') ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $category = $this->route('expenseCategory');

        return [
            'name' => ['required', 'string', 'max:150', Rule::unique('expense_categories', 'name')->ignore($category?->id)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
