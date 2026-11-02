<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Dish;
use App\Models\Expense;
use App\Models\HeldOrder;
use App\Models\InventoryItem;
use App\Models\Purchase;
use App\Models\Refund;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request): JsonResponse
    {
        $now = now();
        $statsYear = (int) $request->integer('year', $now->year);
        if ($statsYear < 2000 || $statsYear > 2100) {
            $statsYear = $now->year;
        }

        $todayStart = $now->copy()->startOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $prevMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $prevMonthEnd = $now->copy()->subMonthNoOverflow()->endOfMonth();
        $weekStart = $now->copy()->startOfWeek();

        $todaySalesQuery = Sale::query()->where('status', 'completed')->where('sold_at', '>=', $todayStart);
        $todayOrders = (clone $todaySalesQuery)->count();

        $month = $this->periodMetrics($monthStart, $now);
        $previous = $this->periodMetrics($prevMonthStart, $prevMonthEnd);

        $chart = $this->salesPurchaseChart($now->copy()->subMonths(11)->startOfMonth(), $now);
        $salesStatistics = $this->salesStatistics($statsYear);

        $topProducts = SaleItem::query()
            ->select([
                'dish_id',
                'dish_name',
                DB::raw('SUM(quantity) as qty_sold'),
                DB::raw('SUM(total) as revenue'),
                DB::raw('AVG(unit_price) as avg_price'),
            ])
            ->whereHas('sale', fn ($q) => $q->where('status', 'completed')->where('sold_at', '>=', $monthStart))
            ->groupBy('dish_id', 'dish_name')
            ->orderByDesc('qty_sold')
            ->limit(5)
            ->get();

        $lowStock = InventoryItem::query()
            ->where('is_active', true)
            ->whereColumn('current_stock', '<=', 'reorder_level')
            ->orderBy('current_stock')
            ->limit(5)
            ->get(['id', 'name', 'sku', 'current_stock', 'reorder_level', 'unit']);

        $lowStockCount = InventoryItem::query()
            ->where('is_active', true)
            ->whereColumn('current_stock', '<=', 'reorder_level')
            ->count();

        $recentSales = Sale::query()
            ->with(['cashier:id,name', 'customer:id,name'])
            ->latest('sold_at')
            ->limit(6)
            ->get(['id', 'invoice_number', 'cashier_id', 'customer_id', 'order_type', 'status', 'grand_total', 'sold_at']);

        $suppliersCount = Supplier::query()->count();
        $customersCount = Customer::query()->count();
        $ordersMonthCount = Sale::query()->where('status', 'completed')->where('sold_at', '>=', $monthStart)->count();

        $customerOverview = $this->customerOverview();
        $transactions = $this->recentTransactions();
        $topCustomers = $this->topCustomers($monthStart);
        $topCategories = $this->topCategories($weekStart);
        $orderStatistics = $this->orderHeatmap($weekStart);

        return $this->success('Dashboard retrieved.', [
            'user_greeting' => true,
            'today' => [
                'orders' => $todayOrders,
                'sales' => (clone $todaySalesQuery)->sum('grand_total'),
            ],
            'summary' => [
                'total_sales' => $month['sales'],
                'total_sales_return' => $month['sales_return'],
                'total_purchase' => $month['purchase'],
                'total_purchase_return' => $month['purchase_return'],
                'profit' => $month['profit'],
                'invoice_due' => $month['invoice_due'],
                'total_expenses' => $month['expenses'],
                'total_payment_returns' => $month['sales_return'],
            ],
            'changes' => [
                'total_sales' => $this->pctChange($month['sales'], $previous['sales']),
                'total_sales_return' => $this->pctChange($month['sales_return'], $previous['sales_return']),
                'total_purchase' => $this->pctChange($month['purchase'], $previous['purchase']),
                'total_purchase_return' => $this->pctChange($month['purchase_return'], $previous['purchase_return']),
                'profit' => $this->pctChange($month['profit'], $previous['profit']),
                'invoice_due' => $this->pctChange($month['invoice_due'], $previous['invoice_due']),
                'total_expenses' => $this->pctChange($month['expenses'], $previous['expenses']),
                'total_payment_returns' => $this->pctChange($month['sales_return'], $previous['sales_return']),
            ],
            'overall' => [
                'suppliers' => $suppliersCount,
                'customers' => $customersCount,
                'orders' => $ordersMonthCount,
            ],
            'customers_overview' => $customerOverview,
            'chart' => $chart,
            'sales_statistics' => $salesStatistics,
            'transactions' => $transactions,
            'top_customers' => $topCustomers,
            'top_categories' => $topCategories,
            'order_statistics' => $orderStatistics,
            'top_products' => $topProducts,
            'low_stock' => $lowStock,
            'low_stock_count' => $lowStockCount,
            'recent_sales' => $recentSales,
            'by_order_type' => Sale::query()
                ->where('status', 'completed')
                ->where('sold_at', '>=', $monthStart)
                ->select('order_type', DB::raw('SUM(grand_total) as total'))
                ->groupBy('order_type')
                ->pluck('total', 'order_type'),
            'period' => [
                'label' => 'This Month',
                'from' => $monthStart->toDateString(),
                'to' => $now->toDateString(),
            ],
            'available_years' => range($now->year, max(2020, $now->year - 4)),
        ]);
    }

    /**
     * @return array{sales: float, sales_return: float, purchase: float, purchase_return: float, expenses: float, cogs: float, profit: float, invoice_due: float}
     */
    private function periodMetrics(Carbon $from, Carbon $to): array
    {
        $sales = (float) Sale::query()
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$from, $to])
            ->sum('grand_total');

        $salesReturn = (float) Refund::query()
            ->whereBetween('refunded_at', [$from, $to])
            ->sum('amount');

        $purchase = (float) Purchase::query()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()])
            ->sum('total');

        // No dedicated purchase-return module — cancelled purchases in period.
        $purchaseReturn = (float) Purchase::query()
            ->where('status', 'cancelled')
            ->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()])
            ->sum('total');

        $expenses = (float) Expense::query()
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $cogs = (float) SaleItem::query()
            ->whereHas('sale', fn ($q) => $q->where('status', 'completed')->whereBetween('sold_at', [$from, $to]))
            ->selectRaw('COALESCE(SUM(quantity * unit_cost), 0) as cogs')
            ->value('cogs');

        $invoiceDue = (float) Purchase::query()
            ->where('remaining', '>', 0)
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->sum('remaining');

        $profit = $sales - $salesReturn - $cogs - $expenses;

        return [
            'sales' => $sales,
            'sales_return' => $salesReturn,
            'purchase' => $purchase,
            'purchase_return' => $purchaseReturn,
            'expenses' => $expenses,
            'cogs' => $cogs,
            'profit' => $profit,
            'invoice_due' => $invoiceDue,
        ];
    }

    /**
     * @return list<array{month: string, label: string, sales: float, purchase: float}>
     */
    private function salesPurchaseChart(Carbon $from, Carbon $to): array
    {
        $salesRows = Sale::query()
            ->where('status', 'completed')
            ->where('sold_at', '>=', $from)
            ->selectRaw("DATE_FORMAT(sold_at, '%Y-%m') as ym, SUM(grand_total) as total")
            ->groupBy('ym')
            ->pluck('total', 'ym');

        $purchaseRows = Purchase::query()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->where('purchase_date', '>=', $from->toDateString())
            ->selectRaw("DATE_FORMAT(purchase_date, '%Y-%m') as ym, SUM(total) as total")
            ->groupBy('ym')
            ->pluck('total', 'ym');

        $points = [];
        $cursor = $from->copy()->startOfMonth();
        while ($cursor <= $to) {
            $key = $cursor->format('Y-m');
            $points[] = [
                'month' => $key,
                'label' => $cursor->format('M'),
                'sales' => (float) ($salesRows[$key] ?? 0),
                'purchase' => (float) ($purchaseRows[$key] ?? 0),
            ];
            $cursor->addMonth();
        }

        return $points;
    }

    /**
     * @return array{first_time: int, returning: int, first_time_pct: float, returning_pct: float}
     */
    private function customerOverview(): array
    {
        $counts = Sale::query()
            ->where('status', 'completed')
            ->whereNotNull('customer_id')
            ->select('customer_id', DB::raw('COUNT(*) as sales_count'))
            ->groupBy('customer_id')
            ->get();

        $firstTime = $counts->where('sales_count', 1)->count();
        $returning = $counts->where('sales_count', '>', 1)->count();
        $total = max(1, $firstTime + $returning);

        return [
            'first_time' => $firstTime,
            'returning' => $returning,
            'first_time_pct' => round(($firstTime / $total) * 100, 1),
            'returning_pct' => round(($returning / $total) * 100, 1),
        ];
    }

    private function pctChange(float $current, float $previous): float
    {
        if (abs($previous) < 0.00001) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / abs($previous)) * 100, 1);
    }

    /**
     * Yearly revenue vs expense chart (expense rendered as negative for diverging bars).
     *
     * @return array{year: int, revenue: float, expense: float, revenue_change: float, expense_change: float, months: list<array{label: string, revenue: float, expense: float}>}
     */
    private function salesStatistics(int $year): array
    {
        $from = Carbon::create($year, 1, 1)->startOfDay();
        $to = Carbon::create($year, 12, 31)->endOfDay();
        $prevFrom = Carbon::create($year - 1, 1, 1)->startOfDay();
        $prevTo = Carbon::create($year - 1, 12, 31)->endOfDay();

        $revenueRows = Sale::query()
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(sold_at, '%m') as m, SUM(grand_total) as total")
            ->groupBy('m')
            ->pluck('total', 'm');

        $expenseRows = Expense::query()
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw("DATE_FORMAT(expense_date, '%m') as m, SUM(amount) as total")
            ->groupBy('m')
            ->pluck('total', 'm');

        $months = [];
        $revenueTotal = 0.0;
        $expenseTotal = 0.0;
        for ($m = 1; $m <= 12; $m++) {
            $key = str_pad((string) $m, 2, '0', STR_PAD_LEFT);
            $rev = (float) ($revenueRows[$key] ?? 0);
            $exp = (float) ($expenseRows[$key] ?? 0);
            $revenueTotal += $rev;
            $expenseTotal += $exp;
            $months[] = [
                'label' => Carbon::create($year, $m, 1)->format('M'),
                'revenue' => $rev,
                'expense' => $exp > 0 ? -$exp : 0.0,
                'expense_abs' => $exp,
            ];
        }

        $prevRevenue = (float) Sale::query()->where('status', 'completed')->whereBetween('sold_at', [$prevFrom, $prevTo])->sum('grand_total');
        $prevExpense = (float) Expense::query()->whereBetween('expense_date', [$prevFrom->toDateString(), $prevTo->toDateString()])->sum('amount');

        return [
            'year' => $year,
            'revenue' => $revenueTotal,
            'expense' => $expenseTotal,
            'revenue_change' => $this->pctChange($revenueTotal, $prevRevenue),
            'expense_change' => $this->pctChange($expenseTotal, $prevExpense),
            'months' => $months,
        ];
    }

    /**
     * @return array{sale: list<array<string, mixed>>, purchase: list<array<string, mixed>>, quotation: list<array<string, mixed>>, expenses: list<array<string, mixed>>, invoices: list<array<string, mixed>>}
     */
    private function recentTransactions(): array
    {
        $sales = Sale::query()
            ->with('customer:id,name,customer_code')
            ->latest('sold_at')
            ->limit(6)
            ->get(['id', 'invoice_number', 'customer_id', 'status', 'grand_total', 'sold_at'])
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'date' => optional($sale->sold_at)?->toIso8601String(),
                'party' => $sale->customer?->name ?: 'Walk-in',
                'code' => $sale->invoice_number,
                'status' => $sale->status,
                'total' => (float) $sale->grand_total,
                'link' => '/sales/'.$sale->id,
            ])
            ->all();

        $purchases = Purchase::query()
            ->with('supplier:id,name')
            ->latest('purchase_date')
            ->latest('id')
            ->limit(6)
            ->get(['id', 'purchase_number', 'supplier_id', 'status', 'total', 'purchase_date'])
            ->map(fn (Purchase $row) => [
                'id' => $row->id,
                'date' => optional($row->purchase_date)?->toDateString(),
                'party' => $row->supplier?->name ?: 'Supplier',
                'code' => $row->purchase_number,
                'status' => $row->status,
                'total' => (float) $row->total,
                'link' => '/purchases/'.$row->id,
            ])
            ->all();

        $quotations = HeldOrder::query()
            ->with('cashier:id,name')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(function (HeldOrder $row) {
                $payload = is_array($row->payload) ? $row->payload : [];
                $total = (float) ($payload['grand_total'] ?? $payload['total'] ?? 0);

                return [
                    'id' => $row->id,
                    'date' => optional($row->created_at)?->toIso8601String(),
                    'party' => $row->cashier?->name ?: 'Held order',
                    'code' => 'HOLD-'.$row->id,
                    'status' => 'held',
                    'total' => $total,
                    'link' => '/pos',
                ];
            })
            ->all();

        $expenses = Expense::query()
            ->with('category:id,name')
            ->latest('expense_date')
            ->latest('id')
            ->limit(6)
            ->get(['id', 'expense_number', 'expense_category_id', 'amount', 'expense_date', 'description'])
            ->map(fn (Expense $row) => [
                'id' => $row->id,
                'date' => optional($row->expense_date)?->toDateString(),
                'party' => $row->category?->name ?: ($row->description ?: 'Expense'),
                'code' => $row->expense_number,
                'status' => 'approved',
                'total' => (float) $row->amount,
                'link' => '/finance/expenses',
            ])
            ->all();

        $invoices = collect($sales)->map(function (array $row) {
            $row['link'] = '/sales/'.$row['id'];

            return $row;
        })->all();

        return [
            'sale' => $sales,
            'purchase' => $purchases,
            'quotation' => $quotations,
            'expenses' => $expenses,
            'invoices' => $invoices,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function topCustomers(Carbon $from): array
    {
        return Sale::query()
            ->where('status', 'completed')
            ->whereNotNull('customer_id')
            ->where('sold_at', '>=', $from)
            ->select([
                'customer_id',
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(grand_total) as total_spent'),
            ])
            ->groupBy('customer_id')
            ->orderByDesc('total_spent')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                $customer = Customer::query()->find($row->customer_id);

                return [
                    'id' => $row->customer_id,
                    'name' => $customer?->name ?: 'Customer',
                    'city' => $customer?->city ?: 'Local',
                    'orders_count' => (int) $row->orders_count,
                    'total_spent' => (float) $row->total_spent,
                ];
            })
            ->all();
    }

    /**
     * @return array{categories: list<array<string, mixed>>, total_categories: int, total_products: int}
     */
    private function topCategories(Carbon $from): array
    {
        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoin('dishes', 'dishes.id', '=', 'sale_items.dish_id')
            ->leftJoin('categories', 'categories.id', '=', 'dishes.category_id')
            ->where('sales.status', 'completed')
            ->where('sales.sold_at', '>=', $from)
            ->select([
                DB::raw('COALESCE(categories.id, 0) as category_id'),
                DB::raw("COALESCE(categories.name, 'Uncategorized') as category_name"),
                DB::raw('SUM(sale_items.quantity) as qty_sold'),
                DB::raw('SUM(sale_items.total) as revenue'),
            ])
            ->groupByRaw('COALESCE(categories.id, 0), COALESCE(categories.name, \'Uncategorized\')')
            ->orderByDesc('qty_sold')
            ->limit(3)
            ->get();

        $colors = ['#092C4C', '#FE9F43', '#FEC78B'];

        return [
            'categories' => $rows->values()->map(fn ($row, $index) => [
                'id' => (int) $row->category_id,
                'name' => $row->category_name,
                'sales' => (int) $row->qty_sold,
                'revenue' => (float) $row->revenue,
                'color' => $colors[$index] ?? '#646B72',
            ])->all(),
            'total_categories' => Category::query()->count(),
            'total_products' => Dish::query()->count(),
        ];
    }

    /**
     * Weekly order heatmap: hours × weekdays.
     *
     * @return array{hours: list<string>, days: list<string>, cells: list<list<int>>, max: int}
     */
    private function orderHeatmap(Carbon $weekStart): array
    {
        $hours = ['2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
        $hourStarts = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
        $days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        $rows = Sale::query()
            ->where('status', 'completed')
            ->where('sold_at', '>=', $weekStart)
            ->selectRaw('DAYOFWEEK(sold_at) as dow, HOUR(sold_at) as hr, COUNT(*) as total')
            ->groupBy('dow', 'hr')
            ->get();

        // MySQL DAYOFWEEK: 1=Sun ... 7=Sat → map to Mon-first index 0..6
        $map = [];
        foreach ($rows as $row) {
            $dow = (int) $row->dow; // 1 Sun .. 7 Sat
            $dayIndex = $dow === 1 ? 6 : $dow - 2;
            $hr = (int) $row->hr;
            $bucket = (int) floor($hr / 2) * 2;
            if ($bucket < 2) {
                $bucket = 2;
            }
            if ($bucket > 22) {
                $bucket = 22;
            }
            $key = $dayIndex.'-'.$bucket;
            $map[$key] = ($map[$key] ?? 0) + (int) $row->total;
        }

        $cells = [];
        $max = 1;
        foreach ($hourStarts as $hour) {
            $row = [];
            foreach (range(0, 6) as $dayIndex) {
                $value = (int) ($map[$dayIndex.'-'.$hour] ?? 0);
                $row[] = $value;
                $max = max($max, $value);
            }
            $cells[] = $row;
        }

        return [
            'hours' => $hours,
            'days' => $days,
            'cells' => $cells,
            'max' => $max,
        ];
    }
}
