<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAccountAdjustmentRequest;
use App\Http\Requests\UpsertAccountRequest;
use App\Models\Account;
use App\Services\ActivityLogger;
use App\Services\LedgerService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'max:30'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $accounts = Account::query()
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('code', 'like', $search));
            })
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return $this->paginated('Accounts retrieved.', $accounts);
    }

    public function store(UpsertAccountRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $data['type'] = $data['type'] ?? 'cash';
        $data['opening_balance'] = $data['opening_balance'] ?? 0;
        $data['current_balance'] = $data['opening_balance'];
        $data['is_active'] = $data['is_active'] ?? true;

        $account = Account::query()->create($data);
        $activityLogger->log($request, 'account.created', 'finance', $account, after: $account->toArray());

        return $this->success('Account created.', $account, 201);
    }

    public function show(Account $account): JsonResponse
    {
        return $this->success('Account retrieved.', $account);
    }

    public function update(UpsertAccountRequest $request, Account $account, ActivityLogger $activityLogger): JsonResponse
    {
        $updated = DB::transaction(function () use ($request, $account, $activityLogger): Account {
            $locked = Account::query()->lockForUpdate()->findOrFail($account->id);
            $before = $locked->toArray();
            $data = $request->validated();

            // Changing the opening balance shifts the running balance by the same delta.
            if (array_key_exists('opening_balance', $data)) {
                $delta = round((float) $data['opening_balance'] - (float) $locked->opening_balance, 2);
                $data['current_balance'] = number_format((float) $locked->current_balance + $delta, 2, '.', '');
            }

            $locked->update($data);
            $activityLogger->log($request, 'account.updated', 'finance', $locked, $before, $locked->fresh()->toArray());

            return $locked->fresh();
        });

        return $this->success('Account updated.', $updated);
    }

    public function adjust(StoreAccountAdjustmentRequest $request, Account $account, LedgerService $ledger, ActivityLogger $activityLogger): JsonResponse
    {
        $transaction = $ledger->adjust(
            $request->user(), $account->id, $request->validated('direction'), (string) $request->validated('amount'),
            $request->validated('reason'), $request->validated('date'),
        );
        $activityLogger->log($request, 'account.adjusted', 'finance', $account, after: $transaction->toArray());

        return $this->success('Account balance adjusted.', [
            'transaction' => $transaction,
            'account' => $account->fresh(),
        ], 201);
    }
}
