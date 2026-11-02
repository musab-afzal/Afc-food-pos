<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertIncomeRequest;
use App\Models\Income;
use App\Services\ActivityLogger;
use App\Services\IncomeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncomeController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:150'],
            'payment_method_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $incomes = Income::query()
            ->with(['paymentMethod:id,name,code', 'user:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('income_number', 'like', $search)
                    ->orWhere('reference', 'like', $search)
                    ->orWhere('description', 'like', $search));
            })
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')->value()))
            ->when($request->filled('payment_method_id'), fn ($query) => $query->where('payment_method_id', $request->integer('payment_method_id')))
            ->when($request->filled('user_id'), fn ($query) => $query->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('income_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('income_date', '<=', $request->date('to')))
            ->latest('income_date')->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Incomes retrieved.', $incomes);
    }

    public function store(UpsertIncomeRequest $request, IncomeService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $income = $service->create($request->user(), $request->validated());
        $activityLogger->log($request, 'income.created', 'finance', $income, after: $income->toArray());

        return $this->success('Income recorded.', $income, 201);
    }

    public function show(Income $income): JsonResponse
    {
        return $this->success('Income retrieved.', $income->load(['paymentMethod:id,name,code', 'user:id,name']));
    }

    public function update(UpsertIncomeRequest $request, Income $income, IncomeService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $income->toArray();
        $updated = $service->update($request->user(), $income, $request->validated());
        $activityLogger->log($request, 'income.updated', 'finance', $updated, $before, $updated->toArray());

        return $this->success('Income updated.', $updated);
    }

    public function destroy(Request $request, Income $income, IncomeService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $income->toArray();
        $service->delete($income);
        $activityLogger->log($request, 'income.deleted', 'finance', $income, $before, ['deleted' => true]);

        return $this->success('Income deleted.');
    }
}
