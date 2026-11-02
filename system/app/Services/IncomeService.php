<?php

namespace App\Services;

use App\Models\Income;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IncomeService
{
    public function __construct(private readonly LedgerService $ledger, private readonly CashRegisterService $cashRegisters) {}

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Income
    {
        return DB::transaction(function () use ($user, $data): Income {
            $income = Income::query()->create([
                'income_number' => 'PENDING-'.Str::uuid(), 'user_id' => $user->id,
                'payment_method_id' => $data['payment_method_id'] ?? null, 'category' => $data['category'],
                'amount' => $data['amount'], 'income_date' => $data['income_date'] ?? now()->toDateString(),
                'reference' => $data['reference'] ?? null, 'description' => $data['description'] ?? null,
            ]);
            $income->update(['income_number' => sprintf('INC-%s-%06d', now()->format('Y'), $income->id)]);

            $this->post($user, $income, $data['account_id'] ?? null);

            return $income->fresh(['paymentMethod', 'user:id,name']);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $user, Income $income, array $data): Income
    {
        return DB::transaction(function () use ($user, $income, $data): Income {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);
            $accountId = array_key_exists('account_id', $data) ? $data['account_id'] : $this->ledger->accountIdFor($income);

            $income->update(collect($data)->only([
                'payment_method_id', 'category', 'amount', 'income_date', 'reference', 'description',
            ])->reject(fn (mixed $value, string $key): bool => $value === null && in_array($key, ['category', 'amount', 'income_date'], true))->all());

            $this->post($user, $income->fresh(), $accountId);

            return $income->fresh(['paymentMethod', 'user:id,name']);
        });
    }

    public function delete(Income $income): void
    {
        DB::transaction(function () use ($income): void {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);
            $this->cashRegisters->removeReference($income);
            $this->ledger->removeForReference($income);
            $income->delete();
        });
    }

    private function post(User $user, Income $income, ?int $accountId): void
    {
        $amount = (string) $income->amount;
        $method = $income->payment_method_id ? PaymentMethod::query()->find($income->payment_method_id) : null;

        $this->ledger->upsertForReference(
            $user, $income, 'income', $income->category, $amount, $income->income_date->toDateString(),
            $accountId, $income->payment_method_id, $income->description ?? "Income {$income->income_number}",
        );
        $this->cashRegisters->syncReference(
            $user, $income, $method?->code === 'cash', 'income', $amount, "Income {$income->income_number}",
        );
    }
}

