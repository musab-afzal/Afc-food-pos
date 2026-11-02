<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertExpenseRequest;
use App\Models\Expense;
use App\Services\ActivityLogger;
use App\Services\ExpenseService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'expense_category_id' => ['nullable', 'integer'],
            'payment_method_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $expenses = Expense::query()
            ->with(['category:id,name', 'paymentMethod:id,name,code', 'user:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('expense_number', 'like', $search)
                    ->orWhere('reference', 'like', $search)
                    ->orWhere('description', 'like', $search));
            })
            ->when($request->filled('expense_category_id'), fn ($query) => $query->where('expense_category_id', $request->integer('expense_category_id')))
            ->when($request->filled('payment_method_id'), fn ($query) => $query->where('payment_method_id', $request->integer('payment_method_id')))
            ->when($request->filled('user_id'), fn ($query) => $query->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('expense_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('expense_date', '<=', $request->date('to')))
            ->latest('expense_date')->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Expenses retrieved.', $expenses);
    }

    public function store(UpsertExpenseRequest $request, ExpenseService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $expense = $service->create($request->user(), $request->validated());
        $activityLogger->log($request, 'expense.created', 'finance', $expense, after: $expense->toArray());

        return $this->success('Expense recorded.', $expense, 201);
    }

    public function show(Expense $expense): JsonResponse
    {
        return $this->success('Expense retrieved.', $expense->load(['category:id,name', 'paymentMethod:id,name,code', 'user:id,name']));
    }

    public function update(UpsertExpenseRequest $request, Expense $expense, ExpenseService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $expense->toArray();
        $updated = $service->update($request->user(), $expense, $request->validated());
        $activityLogger->log($request, 'expense.updated', 'finance', $updated, $before, $updated->toArray());

        return $this->success('Expense updated.', $updated);
    }

    public function destroy(Request $request, Expense $expense, ExpenseService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $expense->toArray();
        $service->delete($expense);
        $activityLogger->log($request, 'expense.deleted', 'finance', $expense, $before, ['deleted' => true]);

        return $this->success('Expense deleted.');
    }
}
