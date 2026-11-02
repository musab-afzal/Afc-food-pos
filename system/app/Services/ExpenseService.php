<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ExpenseService
{
    public function __construct(private readonly LedgerService $ledger, private readonly CashRegisterService $cashRegisters) {}

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Expense
    {
        return DB::transaction(function () use ($user, $data): Expense {
            $category = $this->activeCategory((int) $data['expense_category_id']);

            $expense = Expense::query()->create([
                'expense_number' => 'PENDING-'.Str::uuid(),
                'expense_category_id' => $category->id, 'user_id' => $user->id,
                'payment_method_id' => $data['payment_method_id'] ?? null, 'amount' => $data['amount'],
                'expense_date' => $data['expense_date'] ?? now()->toDateString(),
                'reference' => $data['reference'] ?? null, 'description' => $data['description'] ?? null,
                'attachment' => $data['attachment'] ?? null,
            ]);
            $expense->update(['expense_number' => sprintf('EXP-%s-%06d', now()->format('Y'), $expense->id)]);

            $this->post($user, $expense, $category, $data['account_id'] ?? null);

            return $expense->fresh(['category', 'paymentMethod', 'user:id,name']);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $user, Expense $expense, array $data): Expense
    {
        return DB::transaction(function () use ($user, $expense, $data): Expense {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            $accountId = array_key_exists('account_id', $data) ? $data['account_id'] : $this->ledger->accountIdFor($expense);
            $categoryId = (int) ($data['expense_category_id'] ?? $expense->expense_category_id);
            $category = $categoryId === $expense->expense_category_id
                ? ExpenseCategory::query()->findOrFail($categoryId)
                : $this->activeCategory($categoryId);

            $expense->update(collect($data)->only([
                'expense_category_id', 'payment_method_id', 'amount', 'expense_date', 'reference', 'description', 'attachment',
            ])->reject(fn (mixed $value, string $key): bool => $value === null && in_array($key, ['expense_category_id', 'amount', 'expense_date'], true))->all());

            $this->post($user, $expense->fresh(), $category, $accountId);

            return $expense->fresh(['category', 'paymentMethod', 'user:id,name']);
        });
    }

    public function delete(Expense $expense): void
    {
        DB::transaction(function () use ($expense): void {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            $this->cashRegisters->removeReference($expense);
            $this->ledger->removeForReference($expense);
            $expense->delete();
        });
    }

    private function post(User $user, Expense $expense, ExpenseCategory $category, ?int $accountId): void
    {
        $amount = (string) $expense->amount;
        $method = $expense->payment_method_id ? PaymentMethod::query()->find($expense->payment_method_id) : null;

        $this->ledger->upsertForReference(
            $user, $expense, 'expense', $category->name, $amount, $expense->expense_date->toDateString(),
            $accountId, $expense->payment_method_id, $expense->description ?? "Expense {$expense->expense_number}",
        );
        $this->cashRegisters->syncReference(
            $user, $expense, $method?->code === 'cash', 'expense', $amount, "Expense {$expense->expense_number}",
        );
    }

    private function activeCategory(int $id): ExpenseCategory
    {
        $category = ExpenseCategory::query()->findOrFail($id);
        if (! $category->is_active) {
            throw ValidationException::withMessages(['expense_category_id' => ['The selected expense category is inactive.']]);
        }

        return $category;
    }
}

