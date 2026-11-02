<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloseCashRegisterRequest;
use App\Http\Requests\OpenCashRegisterRequest;
use App\Http\Requests\StoreCashRegisterTransactionRequest;
use App\Models\CashRegister;
use App\Services\ActivityLogger;
use App\Services\CashRegisterService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CashRegisterController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'string', Rule::in(['open', 'closed'])],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $registers = CashRegister::query()
            ->with('user:id,name')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('user_id'), fn ($query) => $query->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('opened_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('opened_at', '<=', $request->date('to')))
            ->latest('opened_at')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Cash registers retrieved.', $registers);
    }

    public function current(Request $request, CashRegisterService $service): JsonResponse
    {
        $register = $service->currentFor($request->user());

        return $this->success(
            $register ? 'Open cash register retrieved.' : 'No open cash register.',
            $register ? $service->present($register) : null,
        );
    }

    public function show(CashRegister $cashRegister, CashRegisterService $service): JsonResponse
    {
        return $this->success('Cash register retrieved.', $service->present($cashRegister));
    }

    public function store(OpenCashRegisterRequest $request, CashRegisterService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $register = $service->open($request->user(), (string) $request->validated('opening_amount'), $request->validated('notes'));
        $activityLogger->log($request, 'cash_register.opened', 'finance', $register, after: $register->toArray());

        return $this->success('Cash register opened.', $service->present($register), 201);
    }

    public function transaction(StoreCashRegisterTransactionRequest $request, int $cashRegister, CashRegisterService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $transaction = $service->addTransaction(
            $request->user(), $cashRegister, $request->validated('type'), (string) $request->validated('amount'), $request->validated('notes'),
        );
        $activityLogger->log($request, 'cash_register.'.$transaction->type, 'finance', $transaction, after: $transaction->toArray());

        return $this->success('Cash transaction recorded.', [
            'transaction' => $transaction,
            'register' => $service->present(CashRegister::query()->findOrFail($cashRegister), false),
        ], 201);
    }

    public function close(CloseCashRegisterRequest $request, int $cashRegister, CashRegisterService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = CashRegister::query()->findOrFail($cashRegister)->toArray();
        $register = $service->close($request->user(), $cashRegister, (string) $request->validated('actual_closing'), $request->validated('notes'));
        $activityLogger->log($request, 'cash_register.closed', 'finance', $register, $before, $register->toArray());

        return $this->success('Cash register closed.', $service->present($register));
    }
}
