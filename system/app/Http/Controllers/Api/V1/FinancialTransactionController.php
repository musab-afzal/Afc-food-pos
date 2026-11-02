<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialTransaction;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialTransactionController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'max:150'],
            'account_id' => ['nullable', 'integer'],
            'payment_method_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = FinancialTransaction::query()
            ->with(['account:id,name,code', 'paymentMethod:id,name,code', 'creator:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('transaction_number', 'like', $search)->orWhere('description', 'like', $search));
            })
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')->value()))
            ->when($request->filled('account_id'), fn ($query) => $query->where('account_id', $request->integer('account_id')))
            ->when($request->filled('payment_method_id'), fn ($query) => $query->where('payment_method_id', $request->integer('payment_method_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('date', '<=', $request->date('to')))
            ->latest('date')->latest('id')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return $this->paginated('Financial transactions retrieved.', $transactions);
    }
}
