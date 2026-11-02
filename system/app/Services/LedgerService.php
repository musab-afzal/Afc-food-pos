<?php

namespace App\Services;

use App\Models\Account;
use App\Models\FinancialTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LedgerService
{
    /** Transaction types that increase an account balance. */
    public const CREDIT_TYPES = ['income', 'adjustment_in'];

    /**
     * Create or update the ledger entry attached to a source record (expense/income)
     * and keep the linked account balance in sync. Must run inside a DB transaction.
     */
    public function upsertForReference(
        User $user,
        Model $reference,
        string $type,
        ?string $category,
        string $amount,
        string $date,
        ?int $accountId,
        ?int $paymentMethodId,
        ?string $description,
    ): FinancialTransaction {
        $existing = FinancialTransaction::query()
            ->where('reference_type', $reference::class)
            ->where('reference_id', $reference->getKey())
            ->lockForUpdate()
            ->first();

        if ($existing) {
            $this->applyToAccount($existing->account_id, $existing->type, (string) $existing->amount, true);
            $existing->update([
                'date' => $date, 'type' => $type, 'category' => $category, 'account_id' => $accountId,
                'payment_method_id' => $paymentMethodId, 'amount' => $amount, 'description' => $description,
            ]);
            $transaction = $existing;
        } else {
            $transaction = FinancialTransaction::query()->create([
                'transaction_number' => 'PENDING-'.Str::uuid(),
                'date' => $date, 'type' => $type, 'category' => $category, 'account_id' => $accountId,
                'payment_method_id' => $paymentMethodId, 'amount' => $amount,
                'reference_type' => $reference::class, 'reference_id' => $reference->getKey(),
                'description' => $description, 'created_by' => $user->id,
            ]);
            $transaction->update(['transaction_number' => $this->number($transaction)]);
        }

        $this->applyToAccount($accountId, $type, $amount, false);

        return $transaction->fresh();
    }

    /** Remove the ledger entry of a source record and revert its account effect. */
    public function removeForReference(Model $reference): void
    {
        $existing = FinancialTransaction::query()
            ->where('reference_type', $reference::class)
            ->where('reference_id', $reference->getKey())
            ->lockForUpdate()
            ->first();

        if (! $existing) {
            return;
        }

        $this->applyToAccount($existing->account_id, $existing->type, (string) $existing->amount, true);
        $existing->delete();
    }

    public function accountIdFor(Model $reference): ?int
    {
        return FinancialTransaction::query()
            ->where('reference_type', $reference::class)
            ->where('reference_id', $reference->getKey())
            ->value('account_id');
    }

    /** Post a manual balance adjustment to an account. */
    public function adjust(User $user, int $accountId, string $direction, string $amount, ?string $reason, ?string $date): FinancialTransaction
    {
        return DB::transaction(function () use ($user, $accountId, $direction, $amount, $reason, $date): FinancialTransaction {
            $account = Account::query()->lockForUpdate()->findOrFail($accountId);
            $type = $direction === 'increase' ? 'adjustment_in' : 'adjustment_out';

            $transaction = FinancialTransaction::query()->create([
                'transaction_number' => 'PENDING-'.Str::uuid(),
                'date' => $date ?? now()->toDateString(), 'type' => $type, 'category' => 'Balance Adjustment',
                'account_id' => $account->id, 'amount' => $amount,
                'reference_type' => Account::class, 'reference_id' => $account->id,
                'description' => $reason, 'created_by' => $user->id,
            ]);
            $transaction->update(['transaction_number' => $this->number($transaction)]);
            $this->applyToAccount($account->id, $type, $amount, false);

            return $transaction->fresh(['account', 'creator:id,name']);
        });
    }

    private function applyToAccount(?int $accountId, string $type, string $amount, bool $reverse): void
    {
        if ($accountId === null) {
            return;
        }

        $account = Account::query()->lockForUpdate()->findOrFail($accountId);

        if (! $reverse && ! $account->is_active) {
            throw ValidationException::withMessages(['account_id' => ['The selected account is inactive.']]);
        }

        $delta = $this->toCents($amount) * (in_array($type, self::CREDIT_TYPES, true) ? 1 : -1) * ($reverse ? -1 : 1);
        $account->update(['current_balance' => number_format(($this->toCents((string) $account->current_balance) + $delta) / 100, 2, '.', '')]);
    }

    private function number(FinancialTransaction $transaction): string
    {
        return sprintf('FT-%s-%06d', now()->format('Y'), $transaction->id);
    }

    private function toCents(string|int|float $amount): int
    {
        return (int) round((float) $amount * 100);
    }
}
