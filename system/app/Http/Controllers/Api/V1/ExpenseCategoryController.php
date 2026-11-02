<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $categories = ExpenseCategory::query()
            ->withCount('expenses')
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return $this->paginated('Expense categories retrieved.', $categories);
    }

    public function store(UpsertExpenseCategoryRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $category = ExpenseCategory::query()->create($request->validated() + ['is_active' => true]);
        $activityLogger->log($request, 'expense_category.created', 'finance', $category, after: $category->toArray());

        return $this->success('Expense category created.', $category, 201);
    }

    public function show(ExpenseCategory $expenseCategory): JsonResponse
    {
        return $this->success('Expense category retrieved.', $expenseCategory->loadCount('expenses'));
    }

    public function update(UpsertExpenseCategoryRequest $request, ExpenseCategory $expenseCategory, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $expenseCategory->toArray();
        $expenseCategory->update($request->validated());
        $activityLogger->log($request, 'expense_category.updated', 'finance', $expenseCategory, $before, $expenseCategory->fresh()->toArray());

        return $this->success('Expense category updated.', $expenseCategory->fresh());
    }

    public function destroy(Request $request, ExpenseCategory $expenseCategory, ActivityLogger $activityLogger): JsonResponse
    {
        if ($expenseCategory->expenses()->exists()) {
            return $this->error('This category has expenses and cannot be deleted. Deactivate it instead.', 422);
        }

        $before = $expenseCategory->toArray();
        $expenseCategory->delete();
        $activityLogger->log($request, 'expense_category.deleted', 'finance', $expenseCategory, $before, ['deleted' => true]);

        return $this->success('Expense category deleted.');
    }
}
