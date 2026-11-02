<?php

namespace App\Services;

use App\Models\Account;
use App\Models\CashRegister;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class FinanceDashboardService
{
    public function __construct(private readonly CashRegisterService $cashRegisters) {}

    /** @return array{key: string, from: CarbonImmutable, to: CarbonImmutable} */
    public function resolvePeriod(string $period, ?string $from, ?string $to): array
    {
        $now = CarbonImmutable::now();

        [$start, $end] = match ($period) {
            'yesterday' => [$now->subDay()->startOfDay(), $now->subDay()->endOfDay()],
            'week' => [$now->startOfWeek(), $now->endOfDay()],
            'month' => [$now->startOfMonth(), $now->endOfDay()],
            'custom' => [CarbonImmutable::parse($from ?? $now->toDateString())->startOfDay(), CarbonImmutable::parse($to ?? $from ?? $now->toDateString())->endOfDay()],
            default => [$now->startOfDay(), $now->endOfDay()],
        };

        return ['key' => $period, 'from' => $start, 'to' => $end];
    }

    /** @return array<string, mixed> */
    public function summary(string $period, ?string $from, ?string $to): array
    {
        $range = $this->resolvePeriod($period, $from, $to);
        $start = $range['from'];
        $end = $range['to'];

        $sales = DB::table('sales')->where('status', 'completed')->whereBetween('sold_at', [$start, $end]);
        $salesTotal = (string) ((clone $sales)->sum('grand_total') ?? 0);

        $expenses = DB::table('expenses')->whereBetween('expense_date', [$start->toDateString(), $end->toDateString()]);
        $expensesTotal = (string) ((clone $expenses)->sum('amount') ?? 0);

        $incomes = DB::table('incomes')->whereBetween('income_date', [$start->toDateString(), $end->toDateString()]);
        $incomesTotal = (string) ((clone $incomes)->sum('amount') ?? 0);

        $openRegisters = CashRegister::query()->with('user:id,name')->where('status', 'open')->orderBy('opened_at')->get();
        $lastClosed = CashRegister::query()->with('user:id,name')->where('status', 'closed')->latest('closed_at')->first();

        return [
            'period' => ['key' => $range['key'], 'from' => $start->toDateString(), 'to' => $end->toDateString()],
            'sales' => [
                'total' => $this->money($salesTotal),
                'count' => (clone $sales)->count(),
                'tax' => $this->money((string) ((clone $sales)->sum('tax_total') ?? 0)),
                'discounts' => $this->money((string) ((clone $sales)->sum('discount_total') ?? 0)),
            ],
            'expenses' => [
                'total' => $this->money($expensesTotal),
                'count' => (clone $expenses)->count(),
                'by_category' => (clone $expenses)
                    ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
                    ->groupBy('expense_categories.id', 'expense_categories.name')
                    ->orderByDesc(DB::raw('SUM(expenses.amount)'))
                    ->get(['expense_categories.id as category_id', 'expense_categories.name as category', DB::raw('SUM(expenses.amount) as total')]),
            ],
            'incomes' => [
                'total' => $this->money($incomesTotal),
                'count' => (clone $incomes)->count(),
                'by_category' => (clone $incomes)->groupBy('category')->orderByDesc(DB::raw('SUM(amount)'))
                    ->get(['category', DB::raw('SUM(amount) as total')]),
            ],
            'net' => $this->money((string) (((float) $salesTotal) + ((float) $incomesTotal) - ((float) $expensesTotal))),
            'cash_register' => [
                'status' => $openRegisters->isNotEmpty() ? 'open' : 'closed',
                'open_count' => $openRegisters->count(),
                'open_registers' => $openRegisters->map(fn (CashRegister $register): array => $this->cashRegisters->present($register, false))->values(),
                'last_closed' => $lastClosed,
            ],
            'accounts' => [
                'total_balance' => $this->money((string) (Account::query()->where('is_active', true)->sum('current_balance') ?? 0)),
                'count' => Account::query()->where('is_active', true)->count(),
            ],
        ];
    }

    private function money(string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }
}
