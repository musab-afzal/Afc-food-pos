<?php

namespace App\Services;

use App\Models\CashRegister;
use App\Models\CashRegisterTransaction;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashRegisterService
{
    public const IN_TYPES = ['cash_in', 'cash_sale', 'income'];

    public const OUT_TYPES = ['cash_out', 'expense'];

    public function open(User $user, string $openingAmount, ?string $notes): CashRegister
    {
        return DB::transaction(function () use ($user, $openingAmount, $notes): CashRegister {
            // Serialise concurrent opens for the same user by locking the user row.
            User::query()->lockForUpdate()->findOrFail($user->id);

            if (CashRegister::query()->where('user_id', $user->id)->where('status', 'open')->exists()) {
                throw ValidationException::withMessages(['cash_register' => ['You already have an open cash register.']]);
            }

            return CashRegister::query()->create([
                'user_id' => $user->id, 'status' => 'open', 'opening_amount' => $openingAmount,
                'opened_at' => now(), 'notes' => $notes,
            ])->load('user:id,name');
        });
    }

    public function currentFor(User $user): ?CashRegister
    {
        return CashRegister::query()->with('user:id,name')
            ->where('user_id', $user->id)->where('status', 'open')->latest('opened_at')->first();
    }

    /**
     * Register data plus live summary and transactions, ready for API output.
     *
     * @return array<string, mixed>
     */
    public function present(CashRegister $register, bool $withTransactions = true): array
    {
        $register->loadMissing('user:id,name');
        $data = $register->toArray();
        $data['summary'] = $this->summary($register);

        if ($withTransactions) {
            $data['transactions'] = $register->transactions()->with('creator:id,name')->latest('id')->get()->toArray();
        }

        return $data;
    }

    /** @return array<string, mixed> */
    public function summary(CashRegister $register): array
    {
        $totals = $register->transactions()->select('type', DB::raw('SUM(amount) as total'))->groupBy('type')->pluck('total', 'type');
        $pendingCashSales = $register->status === 'open' ? $this->pendingCashSales($register, now()) : collect();

        $pendingCents = $pendingCashSales->sum(fn (array $row): int => $row['net_cents']);
        $inCents = $this->sumCents($totals, self::IN_TYPES) + $pendingCents;
        $outCents = $this->sumCents($totals, self::OUT_TYPES);
        $openingCents = $this->toCents((string) $register->opening_amount);

        return [
            'opening_amount' => $this->money($openingCents),
            'cash_sales' => $this->money($this->sumCents($totals, ['cash_sale']) + $pendingCents),
            'cash_in' => $this->money($this->sumCents($totals, ['cash_in'])),
            'income' => $this->money($this->sumCents($totals, ['income'])),
            'cash_out' => $this->money($this->sumCents($totals, ['cash_out'])),
            'expenses' => $this->money($this->sumCents($totals, ['expense'])),
            'total_in' => $this->money($inCents),
            'total_out' => $this->money($outCents),
            'expected_closing' => $register->status === 'open'
                ? $this->money($openingCents + $inCents - $outCents)
                : (string) $register->expected_closing,
        ];
    }

    public function addTransaction(User $user, int $registerId, string $type, string $amount, ?string $notes): CashRegisterTransaction
    {
        return DB::transaction(function () use ($user, $registerId, $type, $amount, $notes): CashRegisterTransaction {
            $register = CashRegister::query()->lockForUpdate()->findOrFail($registerId);
            $this->assertOpen($register);

            return $register->transactions()->create([
                'type' => $type, 'amount' => $amount, 'notes' => $notes, 'created_by' => $user->id,
            ])->load('creator:id,name');
        });
    }

    public function close(User $user, int $registerId, string $actualClosing, ?string $notes): CashRegister
    {
        return DB::transaction(function () use ($user, $registerId, $actualClosing, $notes): CashRegister {
            $register = CashRegister::query()->lockForUpdate()->findOrFail($registerId);
            $this->assertOpen($register);

            $closedAt = now();
            foreach ($this->pendingCashSales($register, $closedAt) as $row) {
                if ($row['net_cents'] > 0) {
                    $register->transactions()->create([
                        'type' => 'cash_sale', 'amount' => $this->money($row['net_cents']),
                        'reference_type' => Sale::class, 'reference_id' => $row['sale_id'],
                        'notes' => 'POS cash sale', 'created_by' => $user->id,
                    ]);
                }
            }

            $totals = $register->transactions()->select('type', DB::raw('SUM(amount) as total'))->groupBy('type')->pluck('total', 'type');
            $expectedCents = $this->toCents((string) $register->opening_amount)
                + $this->sumCents($totals, self::IN_TYPES)
                - $this->sumCents($totals, self::OUT_TYPES);
            $differenceCents = $this->toCents($actualClosing) - $expectedCents;

            $register->update([
                'status' => 'closed', 'expected_closing' => $this->money($expectedCents),
                'actual_closing' => $actualClosing, 'difference' => $this->money($differenceCents),
                'closed_at' => $closedAt, 'notes' => $notes ?? $register->notes,
            ]);

            return $register->fresh('user:id,name');
        });
    }

    /** The open register used to record cash movements for $user, if one exists. */
    public function openRegisterFor(User $user): ?CashRegister
    {
        return CashRegister::query()->where('status', 'open')
            ->orderByRaw('user_id = ? desc', [$user->id])->latest('opened_at')->lockForUpdate()->first();
    }

    /**
     * Record the cash portion of a POS sale on the cashier's open register right away.
     * No-op when the cashier has no open register or the sale is already recorded
     * (so closing the register via pendingCashSales never double counts it).
     * Must run inside a DB transaction.
     */
    public function recordCashSale(User $user, Sale $sale, string|int|float $amount): ?CashRegisterTransaction
    {
        if ($this->toCents((string) $amount) <= 0) {
            return null;
        }

        $register = CashRegister::query()->where('user_id', $user->id)->where('status', 'open')
            ->latest('opened_at')->lockForUpdate()->first();

        if (! $register) {
            return null;
        }

        $alreadyRecorded = CashRegisterTransaction::query()
            ->where('reference_type', Sale::class)->where('reference_id', $sale->id)->exists();

        if ($alreadyRecorded) {
            return null;
        }

        return $register->transactions()->create([
            'type' => 'cash_sale', 'amount' => $this->money($this->toCents((string) $amount)),
            'reference_type' => Sale::class, 'reference_id' => $sale->id,
            'notes' => 'POS cash sale', 'created_by' => $user->id,
        ]);
    }

    /**
     * Keep the cash drawer entry for a source record (expense/income) in sync.
     * Must run inside a DB transaction.
     */
    public function syncReference(User $user, Model $reference, bool $isCash, string $type, string $amount, ?string $notes): void
    {
        $existing = CashRegisterTransaction::query()
            ->where('reference_type', $reference::class)->where('reference_id', $reference->getKey())
            ->lockForUpdate()->first();

        if ($existing) {
            $register = CashRegister::query()->lockForUpdate()->findOrFail($existing->cash_register_id);
            $unchanged = $isCash && $existing->type === $type && $this->toCents((string) $existing->amount) === $this->toCents($amount);

            if ($unchanged) {
                return;
            }
            if ($register->status !== 'open') {
                throw ValidationException::withMessages(['cash_register' => ['This record is part of a closed cash register session and its cash amount cannot be changed.']]);
            }

            $existing->delete();
        }

        if (! $isCash) {
            return;
        }

        $register = $this->openRegisterFor($user);
        if (! $register) {
            return;
        }

        $register->transactions()->create([
            'type' => $type, 'amount' => $amount, 'reference_type' => $reference::class,
            'reference_id' => $reference->getKey(), 'notes' => $notes, 'created_by' => $user->id,
        ]);
    }

    /** Remove the cash drawer entry of a source record. Must run inside a DB transaction. */
    public function removeReference(Model $reference): void
    {
        $existing = CashRegisterTransaction::query()
            ->where('reference_type', $reference::class)->where('reference_id', $reference->getKey())
            ->lockForUpdate()->first();

        if (! $existing) {
            return;
        }

        $register = CashRegister::query()->lockForUpdate()->findOrFail($existing->cash_register_id);
        if ($register->status !== 'open') {
            throw ValidationException::withMessages(['cash_register' => ['This record is part of a closed cash register session and cannot be removed.']]);
        }

        $existing->delete();
    }

    /**
     * Completed POS sales paid in cash by the register owner during the session that
     * are not yet recorded as cash drawer transactions (net of change given back).
     *
     * @return Collection<int, array{sale_id: int, net_cents: int}>
     */
    private function pendingCashSales(CashRegister $register, \DateTimeInterface $until): Collection
    {
        return DB::table('payments')
            ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
            ->join('sales', 'sales.id', '=', 'payments.sale_id')
            ->where('payment_methods.code', 'cash')
            ->where('sales.status', 'completed')
            ->where('payments.received_by', $register->user_id)
            ->where('payments.paid_at', '>=', $register->opened_at)
            ->where('payments.paid_at', '<=', $until)
            ->whereNotExists(fn ($query) => $query->select(DB::raw(1))
                ->from('cash_register_transactions')
                ->whereColumn('cash_register_transactions.reference_id', 'sales.id')
                ->where('cash_register_transactions.reference_type', Sale::class))
            ->groupBy('sales.id', 'sales.change_total')
            ->select('sales.id', 'sales.change_total', DB::raw('SUM(payments.amount) as cash_paid'))
            ->get()
            ->map(fn ($row): array => [
                'sale_id' => (int) $row->id,
                'net_cents' => max(0, $this->toCents((string) $row->cash_paid) - $this->toCents((string) $row->change_total)),
            ]);
    }

    private function assertOpen(CashRegister $register): void
    {
        if ($register->status !== 'open') {
            throw ValidationException::withMessages(['cash_register' => ['This cash register is already closed.']]);
        }
    }

    /** @param Collection<string, mixed> $totals */
    private function sumCents(Collection $totals, array $types): int
    {
        return (int) collect($types)->sum(fn (string $type): int => $this->toCents((string) ($totals[$type] ?? 0)));
    }

    private function toCents(string|int|float $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
