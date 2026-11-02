<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Read-only reporting queries (Phase 13). Every method accepts an inclusive from/to date range and
 * returns plain arrays that the controller wraps in the standard ApiResponse envelope.
 *
 * Conventions: only `completed` sales count as revenue (same as the finance dashboard), money values
 * are floats rounded to 2 decimals, quantities are floats, counts are ints.
 */
class ReportService
{
    public const MAX_RANGE_DAYS = 366;

    /**
     * Resolve an inclusive date range. Defaults to month-to-date.
     *
     * @return array{from: CarbonImmutable, to: CarbonImmutable, days: int}
     */
    public function range(?string $from, ?string $to): array
    {
        $today = CarbonImmutable::now();

        if ($from !== null && $to !== null) {
            $start = CarbonImmutable::parse($from)->startOfDay();
            $end = CarbonImmutable::parse($to)->endOfDay();
        } elseif ($from !== null) {
            $start = CarbonImmutable::parse($from)->startOfDay();
            $end = $start->greaterThan($today) ? $start->endOfDay() : $today->endOfDay();
        } elseif ($to !== null) {
            $end = CarbonImmutable::parse($to)->endOfDay();
            $start = $end->startOfMonth();
        } else {
            $start = $today->startOfMonth();
            $end = $today->endOfDay();
        }

        if ($end->lessThan($start)) {
            throw ValidationException::withMessages(['to' => ['The to date must be on or after the from date.']]);
        }

        $days = (int) $start->diffInDays($end->startOfDay()) + 1;
        if ($days > self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages(['to' => ['The report range may not exceed '.self::MAX_RANGE_DAYS.' days.']]);
        }

        return ['from' => $start, 'to' => $end, 'days' => $days];
    }

    // ------------------------------------------------------------------------------------------
    // Sales
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function sales(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];

        $totals = $this->salesTotals($start, $end);

        $tendered = DB::table('payments')
            ->join('sales', 'sales.id', '=', 'payments.sale_id')
            ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->groupBy('payment_methods.id', 'payment_methods.name', 'payment_methods.code')
            ->orderByDesc(DB::raw('SUM(payments.amount)'))
            ->selectRaw('payment_methods.id, payment_methods.name, payment_methods.code, COUNT(*) as payments_count, SUM(payments.amount) as tendered')
            ->get();

        // Cash tendered includes the change handed back, so net the change off the cash method.
        $cashChange = (float) $this->completedSales($start, $end)
            ->whereExists(fn (Builder $q) => $q->selectRaw('1')->from('payments')
                ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
                ->whereColumn('payments.sale_id', 'sales.id')
                ->where('payment_methods.code', 'cash'))
            ->sum('sales.change_total');

        $byMethod = $tendered->map(fn ($row): array => [
            'payment_method_id' => (int) $row->id,
            'name' => $row->name,
            'code' => $row->code,
            'payments_count' => (int) $row->payments_count,
            'tendered' => $this->money($row->tendered),
            'net_amount' => $this->money((float) $row->tendered - ($row->code === 'cash' ? $cashChange : 0.0)),
        ])->values();

        $byType = $this->completedSales($start, $end)
            ->groupBy('sales.order_type')
            ->orderByDesc(DB::raw('SUM(sales.grand_total)'))
            ->selectRaw('sales.order_type as order_type, COUNT(*) as orders, SUM(sales.grand_total) as total')
            ->get()
            ->map(fn ($row): array => ['order_type' => $row->order_type, 'orders' => (int) $row->orders, 'total' => $this->money($row->total)])
            ->values();

        $bySource = $this->completedSales($start, $end)
            ->leftJoin('orders', 'orders.id', '=', 'sales.order_id')
            ->groupBy(DB::raw("COALESCE(orders.source, 'direct')"))
            ->orderByDesc(DB::raw('SUM(sales.grand_total)'))
            ->selectRaw("COALESCE(orders.source, 'direct') as source, COUNT(*) as orders, SUM(sales.grand_total) as total")
            ->get()
            ->map(fn ($row): array => ['source' => $row->source, 'orders' => (int) $row->orders, 'total' => $this->money($row->total)])
            ->values();

        $daily = $this->completedSales($start, $end)
            ->groupBy(DB::raw('DATE(sales.sold_at)'))
            ->selectRaw('DATE(sales.sold_at) as day, COUNT(*) as orders, SUM(sales.grand_total) as total, SUM(sales.discount_total) as discounts, SUM(sales.tax_total) as tax')
            ->get()
            ->keyBy('day');

        $series = $this->fillDays($start, $end, fn (string $day): array => [
            'date' => $day,
            'orders' => (int) ($daily[$day]->orders ?? 0),
            'total' => $this->money($daily[$day]->total ?? 0),
            'discounts' => $this->money($daily[$day]->discounts ?? 0),
            'tax' => $this->money($daily[$day]->tax ?? 0),
        ]);

        $refunds = DB::table('refunds')->whereBetween('refunded_at', [$start, $end])
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(amount), 0) as total')->first();

        return [
            'period' => $this->period($r),
            'totals' => $totals,
            'refunds' => ['count' => (int) $refunds->c, 'total' => $this->money($refunds->total)],
            'by_payment_method' => $byMethod,
            'by_order_type' => $byType,
            'by_source' => $bySource,
            'daily' => $series,
        ];
    }

    /** @return array<string, mixed> */
    private function salesTotals(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $t = $this->completedSales($start, $end)->selectRaw(
            'COUNT(*) as orders, COALESCE(SUM(grand_total),0) as total, COALESCE(SUM(subtotal),0) as subtotal, '
            .'COALESCE(SUM(discount_total),0) as discounts, COALESCE(SUM(tax_total),0) as tax, '
            .'COALESCE(SUM(service_charge),0) as service_charge, COALESCE(SUM(delivery_charge),0) as delivery_charge, '
            .'COALESCE(SUM(paid_total),0) as paid_total, COALESCE(SUM(change_total),0) as change_total'
        )->first();

        $orders = (int) $t->orders;

        return [
            'orders' => $orders,
            'total' => $this->money($t->total),
            'subtotal' => $this->money($t->subtotal),
            'discounts' => $this->money($t->discounts),
            'tax' => $this->money($t->tax),
            'service_charge' => $this->money($t->service_charge),
            'delivery_charge' => $this->money($t->delivery_charge),
            'paid_total' => $this->money($t->paid_total),
            'change_total' => $this->money($t->change_total),
            'average_ticket' => $orders > 0 ? $this->money((float) $t->total / $orders) : 0.0,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Dishes
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function dishes(?string $from, ?string $to, int $limit = 10): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $limit = max(1, min($limit, 100));

        $rows = $this->completedSaleItems($start, $end)
            ->groupBy('sale_items.dish_id', 'sale_items.dish_name')
            ->selectRaw(
                'sale_items.dish_id, sale_items.dish_name, SUM(sale_items.quantity) as quantity, '
                .'SUM(sale_items.total) as revenue, SUM(sale_items.quantity * sale_items.unit_cost) as cost, '
                .'COUNT(DISTINCT sales.id) as orders'
            )->get()
            ->map(fn ($row): array => [
                'dish_id' => $row->dish_id !== null ? (int) $row->dish_id : null,
                'dish_name' => $row->dish_name,
                'quantity' => (int) $row->quantity,
                'orders' => (int) $row->orders,
                'revenue' => $this->money($row->revenue),
                'cost' => $this->money($row->cost),
                'margin' => $this->money((float) $row->revenue - (float) $row->cost),
            ]);

        $byCategory = $this->completedSaleItems($start, $end)
            ->leftJoin('dishes', 'dishes.id', '=', 'sale_items.dish_id')
            ->leftJoin('categories', 'categories.id', '=', 'dishes.category_id')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->selectRaw("categories.id as category_id, COALESCE(categories.name, 'Uncategorized') as category, SUM(sale_items.quantity) as quantity, SUM(sale_items.total) as revenue")
            ->get()
            ->map(fn ($row): array => [
                'category_id' => $row->category_id !== null ? (int) $row->category_id : null,
                'category' => $row->category,
                'quantity' => (int) $row->quantity,
                'revenue' => $this->money($row->revenue),
            ])->values();

        return [
            'period' => $this->period($r),
            'totals' => [
                'distinct_dishes' => $rows->count(),
                'quantity' => (int) $rows->sum('quantity'),
                'revenue' => $this->money($rows->sum('revenue')),
                'cost' => $this->money($rows->sum('cost')),
            ],
            'top_by_quantity' => $rows->sortByDesc('quantity')->take($limit)->values(),
            'top_by_revenue' => $rows->sortByDesc('revenue')->take($limit)->values(),
            'by_category' => $byCategory,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Inventory
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function inventory(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $dates = [$start->toDateString(), $end->toDateString()];

        $active = fn () => DB::table('inventory_items')->whereNull('inventory_items.deleted_at')->where('inventory_items.is_active', true);

        $stock = $active()->selectRaw(
            'COUNT(*) as total_items, COALESCE(SUM(current_stock * average_cost),0) as valuation, '
            .'COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END),0) as out_of_stock, '
            .'COALESCE(SUM(CASE WHEN current_stock > 0 AND current_stock <= reorder_level THEN 1 ELSE 0 END),0) as low_stock'
        )->first();

        $valuationByCategory = $active()
            ->join('inventory_categories', 'inventory_categories.id', '=', 'inventory_items.inventory_category_id')
            ->groupBy('inventory_categories.id', 'inventory_categories.name')
            ->orderByDesc(DB::raw('SUM(inventory_items.current_stock * inventory_items.average_cost)'))
            ->selectRaw('inventory_categories.id as category_id, inventory_categories.name as category, COUNT(*) as items, SUM(inventory_items.current_stock * inventory_items.average_cost) as valuation')
            ->get()
            ->map(fn ($row): array => ['category_id' => (int) $row->category_id, 'category' => $row->category, 'items' => (int) $row->items, 'valuation' => $this->money($row->valuation)])
            ->values();

        $lowStockItems = $active()
            ->where('current_stock', '>', 0)->whereColumn('current_stock', '<=', 'reorder_level')
            ->orderBy('current_stock')->limit(20)
            ->get(['inventory_items.id', 'inventory_items.name', 'inventory_items.sku', 'inventory_items.unit', 'inventory_items.current_stock', 'inventory_items.reorder_level', 'inventory_items.minimum_stock'])
            ->map(fn ($row): array => [
                'id' => (int) $row->id, 'name' => $row->name, 'sku' => $row->sku, 'unit' => $row->unit,
                'current_stock' => (float) $row->current_stock, 'reorder_level' => (float) $row->reorder_level,
                'minimum_stock' => (float) $row->minimum_stock,
            ])->values();

        $wastage = DB::table('wastages')->whereBetween('wastage_date', $dates)
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(total_cost),0) as cost')->first();

        $wastageByReason = DB::table('wastages')->whereBetween('wastage_date', $dates)
            ->groupBy('reason')->orderByDesc(DB::raw('SUM(total_cost)'))
            ->selectRaw('reason, COUNT(*) as records, SUM(total_cost) as cost')->get()
            ->map(fn ($row): array => ['reason' => $row->reason, 'records' => (int) $row->records, 'cost' => $this->money($row->cost)])->values();

        $topWasted = DB::table('wastage_items')
            ->join('wastages', 'wastages.id', '=', 'wastage_items.wastage_id')
            ->join('inventory_items', 'inventory_items.id', '=', 'wastage_items.inventory_item_id')
            ->whereBetween('wastages.wastage_date', $dates)
            ->groupBy('inventory_items.id', 'inventory_items.name', 'inventory_items.unit')
            ->orderByDesc(DB::raw('SUM(wastage_items.total_cost)'))->limit(10)
            ->selectRaw('inventory_items.id as item_id, inventory_items.name, inventory_items.unit, SUM(wastage_items.quantity) as quantity, SUM(wastage_items.total_cost) as cost')
            ->get()
            ->map(fn ($row): array => ['item_id' => (int) $row->item_id, 'name' => $row->name, 'unit' => $row->unit, 'quantity' => (float) $row->quantity, 'cost' => $this->money($row->cost)])->values();

        $topConsumed = DB::table('inventory_movements')
            ->join('inventory_items', 'inventory_items.id', '=', 'inventory_movements.inventory_item_id')
            ->where('inventory_movements.type', 'sale_consumption')
            ->whereBetween('inventory_movements.occurred_at', [$start, $end])
            ->groupBy('inventory_items.id', 'inventory_items.name', 'inventory_items.unit')
            ->orderByDesc(DB::raw('SUM(ABS(inventory_movements.quantity) * inventory_movements.unit_cost)'))->limit(10)
            ->selectRaw('inventory_items.id as item_id, inventory_items.name, inventory_items.unit, SUM(ABS(inventory_movements.quantity)) as quantity, SUM(ABS(inventory_movements.quantity) * inventory_movements.unit_cost) as cost')
            ->get()
            ->map(fn ($row): array => ['item_id' => (int) $row->item_id, 'name' => $row->name, 'unit' => $row->unit, 'quantity' => round((float) $row->quantity, 4), 'cost' => $this->money($row->cost)])->values();

        $movementsByType = DB::table('inventory_movements')->whereBetween('occurred_at', [$start, $end])
            ->groupBy('type')->orderBy('type')
            ->selectRaw('type, COUNT(*) as movements, SUM(quantity) as net_quantity')->get()
            ->map(fn ($row): array => ['type' => $row->type, 'movements' => (int) $row->movements, 'net_quantity' => round((float) $row->net_quantity, 4)])->values();

        return [
            'period' => $this->period($r),
            'valuation' => [
                'total' => $this->money($stock->valuation),
                'total_items' => (int) $stock->total_items,
                'by_category' => $valuationByCategory,
            ],
            'stock' => [
                'low_stock_count' => (int) $stock->low_stock,
                'out_of_stock_count' => (int) $stock->out_of_stock,
                'low_stock_items' => $lowStockItems,
            ],
            'wastage' => [
                'records' => (int) $wastage->c,
                'cost' => $this->money($wastage->cost),
                'by_reason' => $wastageByReason,
                'top_items' => $topWasted,
            ],
            'top_consumed' => $topConsumed,
            'movements_by_type' => $movementsByType,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Purchases
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function purchases(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $dates = [$start->toDateString(), $end->toDateString()];

        $live = fn () => DB::table('purchases')->whereBetween('purchases.purchase_date', $dates)->where('purchases.status', '!=', 'cancelled');

        $t = $live()->selectRaw(
            'COUNT(*) as orders, COALESCE(SUM(total),0) as total, COALESCE(SUM(paid),0) as paid, COALESCE(SUM(remaining),0) as remaining, '
            .'COALESCE(SUM(tax),0) as tax, COALESCE(SUM(discount),0) as discount'
        )->first();

        $byStatus = DB::table('purchases')->whereBetween('purchase_date', $dates)
            ->groupBy('status')->orderBy('status')
            ->selectRaw('status, COUNT(*) as orders, SUM(total) as total')->get()
            ->map(fn ($row): array => ['status' => $row->status, 'orders' => (int) $row->orders, 'total' => $this->money($row->total)])->values();

        $byPaymentStatus = $live()->groupBy('payment_status')->orderBy('payment_status')
            ->selectRaw('payment_status, COUNT(*) as orders, SUM(total) as total, SUM(remaining) as remaining')->get()
            ->map(fn ($row): array => ['payment_status' => $row->payment_status, 'orders' => (int) $row->orders, 'total' => $this->money($row->total), 'remaining' => $this->money($row->remaining)])->values();

        // Value of stock actually received against the POs in the period (qty received x PO unit cost).
        $receivedBySupplier = DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereBetween('purchases.purchase_date', $dates)->where('purchases.status', '!=', 'cancelled')
            ->groupBy('purchases.supplier_id')
            ->selectRaw('purchases.supplier_id, SUM(purchase_items.quantity_received * purchase_items.unit_cost) as received_value')
            ->pluck('received_value', 'supplier_id');

        $bySupplier = $live()
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderByDesc(DB::raw('SUM(purchases.total)'))
            ->selectRaw('suppliers.id as supplier_id, suppliers.name as supplier, COUNT(*) as orders, SUM(purchases.total) as total, SUM(purchases.paid) as paid, SUM(purchases.remaining) as remaining')
            ->get()
            ->map(fn ($row): array => [
                'supplier_id' => (int) $row->supplier_id,
                'supplier' => $row->supplier,
                'orders' => (int) $row->orders,
                'total' => $this->money($row->total),
                'paid' => $this->money($row->paid),
                'remaining' => $this->money($row->remaining),
                'received_value' => $this->money($receivedBySupplier[$row->supplier_id] ?? 0),
            ])->values();

        $receivedInPeriod = DB::table('purchase_receipt_items')
            ->join('purchase_receipts', 'purchase_receipts.id', '=', 'purchase_receipt_items.purchase_receipt_id')
            ->whereBetween('purchase_receipts.received_at', $dates)
            ->selectRaw('COUNT(DISTINCT purchase_receipts.id) as receipts, COALESCE(SUM(purchase_receipt_items.quantity * purchase_receipt_items.unit_cost),0) as value')->first();

        $outstanding = DB::table('purchases')->where('status', '!=', 'cancelled')->where('remaining', '>', 0)->sum('remaining');

        return [
            'period' => $this->period($r),
            'totals' => [
                'orders' => (int) $t->orders,
                'total' => $this->money($t->total),
                'paid' => $this->money($t->paid),
                'remaining' => $this->money($t->remaining),
                'tax' => $this->money($t->tax),
                'discount' => $this->money($t->discount),
                'received_value' => $this->money($receivedBySupplier->sum()),
                'average_order' => (int) $t->orders > 0 ? $this->money((float) $t->total / (int) $t->orders) : 0.0,
            ],
            'receipts_in_period' => ['count' => (int) $receivedInPeriod->receipts, 'value' => $this->money($receivedInPeriod->value)],
            'outstanding_payable' => $this->money($outstanding),
            'by_status' => $byStatus,
            'by_payment_status' => $byPaymentStatus,
            'by_supplier' => $bySupplier,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Finance
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function finance(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $dates = [$start->toDateString(), $end->toDateString()];

        $sales = $this->salesTotals($start, $end);

        $expenses = DB::table('expenses')->whereBetween('expense_date', $dates)
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(amount),0) as total')->first();
        $incomes = DB::table('incomes')->whereBetween('income_date', $dates)
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(amount),0) as total')->first();

        $expenseByCategory = DB::table('expenses')
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->whereBetween('expenses.expense_date', $dates)
            ->groupBy('expense_categories.id', 'expense_categories.name')
            ->orderByDesc(DB::raw('SUM(expenses.amount)'))
            ->selectRaw('expense_categories.id as category_id, expense_categories.name as category, COUNT(*) as records, SUM(expenses.amount) as total')
            ->get()
            ->map(fn ($row): array => ['category_id' => (int) $row->category_id, 'category' => $row->category, 'records' => (int) $row->records, 'total' => $this->money($row->total)])->values();

        $incomeByCategory = DB::table('incomes')->whereBetween('income_date', $dates)
            ->groupBy('category')->orderByDesc(DB::raw('SUM(amount)'))
            ->selectRaw('category, COUNT(*) as records, SUM(amount) as total')->get()
            ->map(fn ($row): array => ['category' => $row->category, 'records' => (int) $row->records, 'total' => $this->money($row->total)])->values();

        $dailySales = $this->completedSales($start, $end)
            ->groupBy(DB::raw('DATE(sales.sold_at)'))
            ->selectRaw('DATE(sales.sold_at) as day, SUM(sales.grand_total) as total')->pluck('total', 'day');
        $dailyExpenses = DB::table('expenses')->whereBetween('expense_date', $dates)
            ->groupBy('expense_date')->selectRaw('expense_date as day, SUM(amount) as total')->pluck('total', 'day');
        $dailyIncomes = DB::table('incomes')->whereBetween('income_date', $dates)
            ->groupBy('income_date')->selectRaw('income_date as day, SUM(amount) as total')->pluck('total', 'day');

        $daily = $this->fillDays($start, $end, function (string $day) use ($dailySales, $dailyExpenses, $dailyIncomes): array {
            $s = (float) ($dailySales[$day] ?? 0);
            $i = (float) ($dailyIncomes[$day] ?? 0);
            $e = (float) ($dailyExpenses[$day] ?? 0);

            return ['date' => $day, 'sales' => $this->money($s), 'incomes' => $this->money($i), 'expenses' => $this->money($e), 'net' => $this->money($s + $i - $e)];
        });

        $net = (float) $sales['total'] + (float) $incomes->total - (float) $expenses->total;

        return [
            'period' => $this->period($r),
            'totals' => [
                'sales' => $sales['total'],
                'sales_orders' => $sales['orders'],
                'incomes' => $this->money($incomes->total),
                'expenses' => $this->money($expenses->total),
                'net' => $this->money($net),
                'expense_ratio_percent' => (float) $sales['total'] > 0 ? round((float) $expenses->total / (float) $sales['total'] * 100, 2) : 0.0,
            ],
            'expenses_by_category' => $expenseByCategory,
            'incomes_by_category' => $incomeByCategory,
            'daily' => $daily,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Staff
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function staff(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $dates = [$start->toDateString(), $end->toDateString()];

        $att = DB::table('attendance')->whereBetween('date', $dates)->selectRaw(
            'COUNT(*) as records, '
            .implode(', ', array_map(fn (string $s): string => "COALESCE(SUM(status = '$s'),0) as `$s`", ['present', 'late', 'absent', 'leave', 'half_day']))
            .', COALESCE(SUM(working_minutes),0) as working_minutes, COALESCE(SUM(late_minutes),0) as late_minutes, COALESCE(SUM(overtime_minutes),0) as overtime_minutes'
        )->first();

        $records = (int) $att->records;
        $attended = (int) $att->present + (int) $att->late + (int) $att->half_day;

        $perStaff = DB::table('attendance')
            ->join('staff', 'staff.id', '=', 'attendance.staff_id')
            ->whereBetween('attendance.date', $dates)
            ->groupBy('staff.id', 'staff.employee_id', 'staff.first_name', 'staff.last_name')
            ->orderBy('staff.first_name')->orderBy('staff.last_name')
            ->selectRaw(
                'staff.id as staff_id, staff.employee_id, staff.first_name, staff.last_name, '
                ."COALESCE(SUM(attendance.status = 'present'),0) as present, COALESCE(SUM(attendance.status = 'late'),0) as late, "
                ."COALESCE(SUM(attendance.status = 'absent'),0) as absent, COALESCE(SUM(attendance.status = 'leave'),0) as on_leave, "
                ."COALESCE(SUM(attendance.status = 'half_day'),0) as half_day, "
                .'COALESCE(SUM(attendance.working_minutes),0) as working_minutes, COALESCE(SUM(attendance.late_minutes),0) as late_minutes, COALESCE(SUM(attendance.overtime_minutes),0) as overtime_minutes'
            )->get()
            ->map(fn ($row): array => [
                'staff_id' => (int) $row->staff_id,
                'employee_id' => $row->employee_id,
                'name' => trim($row->first_name.' '.$row->last_name),
                'present' => (int) $row->present, 'late' => (int) $row->late, 'absent' => (int) $row->absent,
                'leave' => (int) $row->on_leave, 'half_day' => (int) $row->half_day,
                'working_minutes' => (int) $row->working_minutes, 'late_minutes' => (int) $row->late_minutes,
                'overtime_minutes' => (int) $row->overtime_minutes,
            ])->values();

        // Leaves that overlap the period; days are clamped to the period.
        $leaves = fn () => DB::table('leaves')->where('leaves.start_date', '<=', $dates[1])->where('leaves.end_date', '>=', $dates[0]);
        $dayExpr = 'DATEDIFF(LEAST(leaves.end_date, ?), GREATEST(leaves.start_date, ?)) + 1';

        $leaveTotals = $leaves()->selectRaw('COUNT(*) as requests, COALESCE(SUM('.$dayExpr.'),0) as days', [$dates[1], $dates[0]])->first();

        $leaveByStatus = $leaves()->groupBy('leaves.status')->orderBy('leaves.status')
            ->selectRaw('leaves.status, COUNT(*) as requests, COALESCE(SUM('.$dayExpr.'),0) as days', [$dates[1], $dates[0]])->get()
            ->map(fn ($row): array => ['status' => $row->status, 'requests' => (int) $row->requests, 'days' => (int) $row->days])->values();

        $leaveByType = $leaves()->groupBy('leaves.leave_type')->orderBy('leaves.leave_type')
            ->selectRaw('leaves.leave_type, COUNT(*) as requests, COALESCE(SUM('.$dayExpr.'),0) as days', [$dates[1], $dates[0]])->get()
            ->map(fn ($row): array => ['leave_type' => $row->leave_type, 'requests' => (int) $row->requests, 'days' => (int) $row->days])->values();

        $leaveList = $leaves()->join('staff', 'staff.id', '=', 'leaves.staff_id')
            ->orderByDesc('leaves.start_date')->limit(50)
            ->get(['leaves.id', 'leaves.staff_id', 'staff.first_name', 'staff.last_name', 'leaves.leave_type', 'leaves.start_date', 'leaves.end_date', 'leaves.status', 'leaves.reason'])
            ->map(fn ($row): array => [
                'id' => (int) $row->id, 'staff_id' => (int) $row->staff_id, 'staff' => trim($row->first_name.' '.$row->last_name),
                'leave_type' => $row->leave_type, 'start_date' => $row->start_date, 'end_date' => $row->end_date,
                'status' => $row->status, 'reason' => $row->reason,
            ])->values();

        return [
            'period' => $this->period($r),
            'active_staff' => (int) DB::table('staff')->whereNull('deleted_at')->where('status', 'active')->count(),
            'attendance' => [
                'records' => $records,
                'present' => (int) $att->present,
                'late' => (int) $att->late,
                'absent' => (int) $att->absent,
                'leave' => (int) $att->leave,
                'half_day' => (int) $att->half_day,
                'attendance_rate_percent' => $records > 0 ? round($attended / $records * 100, 2) : 0.0,
                'working_minutes' => (int) $att->working_minutes,
                'late_minutes' => (int) $att->late_minutes,
                'overtime_minutes' => (int) $att->overtime_minutes,
                'per_staff' => $perStaff,
            ],
            'leaves' => [
                'requests' => (int) $leaveTotals->requests,
                'days' => (int) $leaveTotals->days,
                'by_status' => $leaveByStatus,
                'by_type' => $leaveByType,
                'list' => $leaveList,
            ],
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Waiters / cashiers
    // ------------------------------------------------------------------------------------------

    /**
     * Per-user sales performance. Completed sales are attributed to `sales.cashier_id`; still-open orders
     * (not completed / cancelled / refunded) are attributed to `orders.created_by` by ordered_at.
     *
     * @return array<string, mixed>
     */
    public function waiters(?string $from, ?string $to, int $limit = 10): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];

        $sales = $this->completedSales($start, $end)
            ->leftJoin('users', 'users.id', '=', 'sales.cashier_id')
            ->groupBy('sales.cashier_id', 'users.name', 'users.email')
            ->orderByDesc(DB::raw('SUM(sales.grand_total)'))
            ->selectRaw(
                'sales.cashier_id as user_id, users.name, users.email, COUNT(*) as orders, '
                .'COALESCE(SUM(sales.grand_total),0) as grand_total, COALESCE(SUM(sales.subtotal),0) as subtotal, '
                .'COALESCE(SUM(sales.discount_total),0) as discounts, COALESCE(SUM(sales.tax_total),0) as tax, '
                .'MAX(sales.sold_at) as last_sale_at'
            )->get();

        $open = DB::table('orders')
            ->whereNotIn('orders.status', ['completed', 'cancelled', 'refunded'])
            ->whereBetween('orders.ordered_at', [$start, $end])
            ->leftJoin('users', 'users.id', '=', 'orders.created_by')
            ->groupBy('orders.created_by', 'users.name', 'users.email')
            ->selectRaw('orders.created_by as user_id, users.name, users.email, COUNT(*) as open_orders, COALESCE(SUM(orders.grand_total),0) as open_value')
            ->get()->keyBy(fn ($row): string => (string) ($row->user_id ?? 'none'));

        $totalSales = (float) $sales->sum('grand_total');

        $rows = $sales->map(function ($row) use ($open, $totalSales): array {
            $key = (string) ($row->user_id ?? 'none');
            $o = $open->get($key);
            $orders = (int) $row->orders;

            return [
                'user_id' => $row->user_id !== null ? (int) $row->user_id : null,
                'name' => $row->name ?? 'Unassigned',
                'email' => $row->email,
                'orders' => $orders,
                'grand_total' => $this->money($row->grand_total),
                'subtotal' => $this->money($row->subtotal),
                'average_ticket' => $orders > 0 ? $this->money((float) $row->grand_total / $orders) : 0.0,
                'discounts' => $this->money($row->discounts),
                'tax' => $this->money($row->tax),
                'share_percent' => $totalSales > 0 ? round((float) $row->grand_total / $totalSales * 100, 2) : 0.0,
                'open_orders' => $o ? (int) $o->open_orders : 0,
                'open_value' => $o ? $this->money($o->open_value) : 0.0,
                'last_sale_at' => $row->last_sale_at,
            ];
        });

        // Users who only have open orders in the period still appear (zero sales).
        $salesKeys = $sales->map(fn ($row): string => (string) ($row->user_id ?? 'none'))->all();
        $openOnly = $open->reject(fn ($row, string $key): bool => in_array($key, $salesKeys, true))->map(fn ($row): array => [
            'user_id' => $row->user_id !== null ? (int) $row->user_id : null,
            'name' => $row->name ?? 'Unassigned',
            'email' => $row->email,
            'orders' => 0, 'grand_total' => 0.0, 'subtotal' => 0.0, 'average_ticket' => 0.0, 'discounts' => 0.0, 'tax' => 0.0,
            'share_percent' => 0.0,
            'open_orders' => (int) $row->open_orders,
            'open_value' => $this->money($row->open_value),
            'last_sale_at' => null,
        ]);

        $waiters = $rows->concat($openOnly)->values();
        $orders = (int) $sales->sum('orders');

        return [
            'period' => $this->period($r),
            'totals' => [
                'staff' => $waiters->count(),
                'orders' => $orders,
                'grand_total' => $this->money($totalSales),
                'average_ticket' => $orders > 0 ? $this->money($totalSales / $orders) : 0.0,
                'discounts' => $this->money($sales->sum('discounts')),
                'open_orders' => (int) $open->sum('open_orders'),
                'open_value' => $this->money($open->sum('open_value')),
            ],
            'top_by_sales' => $waiters->sortByDesc('grand_total')->filter(fn (array $w): bool => $w['orders'] > 0)->take($limit)->values(),
            'top_by_orders' => $waiters->sortByDesc('orders')->filter(fn (array $w): bool => $w['orders'] > 0)->take($limit)->values(),
            'waiters' => $waiters,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Delivery
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function delivery(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];

        $base = fn () => DB::table('deliveries')->whereBetween('deliveries.created_at', [$start, $end]);

        $byStatus = $base()->groupBy('status')->orderBy('status')
            ->selectRaw('status, COUNT(*) as deliveries, COALESCE(SUM(cod_amount),0) as cod, COALESCE(SUM(delivery_charge),0) as delivery_charge')->get();

        $t = $base()->selectRaw(
            'COUNT(*) as deliveries, COALESCE(SUM(delivery_charge),0) as delivery_charge, '
            ."COALESCE(SUM(CASE WHEN status = 'delivered' THEN cod_amount ELSE 0 END),0) as cod_collected, "
            ."COALESCE(SUM(CASE WHEN status IN ('pending','awaiting_assignment','assigned','picked_up','on_the_way') THEN cod_amount ELSE 0 END),0) as cod_pending, "
            ."COALESCE(SUM(CASE WHEN status IN ('failed','cancelled') THEN cod_amount ELSE 0 END),0) as cod_not_collected, "
            ."AVG(CASE WHEN status = 'delivered' AND assigned_at IS NOT NULL AND delivered_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, assigned_at, delivered_at) END) as avg_minutes"
        )->first();

        $count = fn (string ...$statuses): int => (int) $byStatus->whereIn('status', $statuses)->sum('deliveries');

        $riders = $base()->join('riders', 'riders.id', '=', 'deliveries.rider_id')
            ->groupBy('riders.id', 'riders.name')
            ->orderByDesc(DB::raw("SUM(deliveries.status = 'delivered')"))
            ->selectRaw(
                'riders.id as rider_id, riders.name as rider, COUNT(*) as assigned, '
                ."COALESCE(SUM(deliveries.status = 'delivered'),0) as delivered, COALESCE(SUM(deliveries.status = 'failed'),0) as failed, "
                ."COALESCE(SUM(deliveries.status = 'cancelled'),0) as cancelled, "
                ."COALESCE(SUM(CASE WHEN deliveries.status = 'delivered' THEN deliveries.cod_amount ELSE 0 END),0) as cod_collected, "
                .'COALESCE(SUM(deliveries.delivery_charge),0) as delivery_charge, '
                ."AVG(CASE WHEN deliveries.status = 'delivered' AND deliveries.assigned_at IS NOT NULL AND deliveries.delivered_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, deliveries.assigned_at, deliveries.delivered_at) END) as avg_minutes"
            )->get()
            ->map(fn ($row): array => [
                'rider_id' => (int) $row->rider_id,
                'rider' => $row->rider,
                'assigned' => (int) $row->assigned,
                'delivered' => (int) $row->delivered,
                'failed' => (int) $row->failed,
                'cancelled' => (int) $row->cancelled,
                'success_rate_percent' => (int) $row->assigned > 0 ? round((int) $row->delivered / (int) $row->assigned * 100, 2) : 0.0,
                'cod_collected' => $this->money($row->cod_collected),
                'delivery_charge' => $this->money($row->delivery_charge),
                'avg_delivery_minutes' => $row->avg_minutes !== null ? round((float) $row->avg_minutes, 1) : null,
            ])->values();

        $total = (int) $t->deliveries;

        return [
            'period' => $this->period($r),
            'totals' => [
                'deliveries' => $total,
                'delivered' => $count('delivered'),
                'failed' => $count('failed'),
                'cancelled' => $count('cancelled'),
                'active' => $count('pending', 'awaiting_assignment', 'assigned', 'picked_up', 'on_the_way'),
                'success_rate_percent' => $total > 0 ? round($count('delivered') / $total * 100, 2) : 0.0,
                'delivery_charge' => $this->money($t->delivery_charge),
                'avg_delivery_minutes' => $t->avg_minutes !== null ? round((float) $t->avg_minutes, 1) : null,
            ],
            'cod' => [
                'collected' => $this->money($t->cod_collected),
                'pending' => $this->money($t->cod_pending),
                'not_collected' => $this->money($t->cod_not_collected),
                'total' => $this->money((float) $t->cod_collected + (float) $t->cod_pending + (float) $t->cod_not_collected),
            ],
            'by_status' => $byStatus->map(fn ($row): array => [
                'status' => $row->status, 'deliveries' => (int) $row->deliveries,
                'cod' => $this->money($row->cod), 'delivery_charge' => $this->money($row->delivery_charge),
            ])->values(),
            'riders' => $riders,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Kitchen
    // ------------------------------------------------------------------------------------------

    /**
     * Kitchen ticket throughput for tickets created in the period. Times are in minutes and null
     * when no ticket has both timestamps (accepted_at / ready_at / completed_at are nullable).
     *
     * @return array<string, mixed>
     */
    public function kitchen(?string $from, ?string $to): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];

        $base = fn () => DB::table('kitchen_tickets')->whereBetween('kitchen_tickets.created_at', [$start, $end]);

        $mins = fn (string $a, string $b): string => "AVG(CASE WHEN {$a} IS NOT NULL AND {$b} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, {$a}, {$b}) END) / 60";

        $t = $base()->selectRaw(
            'COUNT(*) as tickets, '
            .$mins('created_at', 'accepted_at').' as avg_accept, '
            .$mins('accepted_at', 'ready_at').' as avg_prepare, '
            .$mins('created_at', 'ready_at').' as avg_ready, '
            .$mins('created_at', 'completed_at').' as avg_complete'
        )->first();

        $byStatus = $base()->groupBy('status')->orderBy('status')
            ->selectRaw('status, COUNT(*) as tickets')->get()
            ->map(fn ($row): array => ['status' => $row->status, 'tickets' => (int) $row->tickets])->values();

        $itemsByStatus = DB::table('kitchen_ticket_items')
            ->join('kitchen_tickets', 'kitchen_tickets.id', '=', 'kitchen_ticket_items.kitchen_ticket_id')
            ->whereBetween('kitchen_tickets.created_at', [$start, $end])
            ->groupBy('kitchen_ticket_items.status')->orderBy('kitchen_ticket_items.status')
            ->selectRaw('kitchen_ticket_items.status, COUNT(*) as items')->get()
            ->map(fn ($row): array => ['status' => $row->status, 'items' => (int) $row->items])->values();

        $daily = $base()->groupBy(DB::raw('DATE(kitchen_tickets.created_at)'))
            ->selectRaw(
                'DATE(kitchen_tickets.created_at) as day, COUNT(*) as tickets, '
                ."COALESCE(SUM(status IN ('ready','completed')),0) as ready_or_done, COALESCE(SUM(status = 'completed'),0) as completed, "
                .$mins('created_at', 'ready_at').' as avg_ready'
            )->get()->keyBy('day');

        $series = $this->fillDays($start, $end, fn (string $day): array => [
            'date' => $day,
            'tickets' => (int) ($daily[$day]->tickets ?? 0),
            'ready_or_done' => (int) ($daily[$day]->ready_or_done ?? 0),
            'completed' => (int) ($daily[$day]->completed ?? 0),
            'avg_ready_minutes' => isset($daily[$day]) && $daily[$day]->avg_ready !== null ? round((float) $daily[$day]->avg_ready, 1) : null,
        ]);

        $hourly = $base()->groupBy(DB::raw('HOUR(kitchen_tickets.created_at)'))->orderBy(DB::raw('HOUR(kitchen_tickets.created_at)'))
            ->selectRaw('HOUR(kitchen_tickets.created_at) as hour, COUNT(*) as tickets')->get()
            ->map(fn ($row): array => ['hour' => (int) $row->hour, 'tickets' => (int) $row->tickets])->values();

        $total = (int) $t->tickets;
        $count = fn (string ...$statuses): int => (int) $byStatus->whereIn('status', $statuses)->sum('tickets');
        $avg = fn (mixed $v): ?float => $v !== null ? round((float) $v, 1) : null;

        return [
            'period' => $this->period($r),
            'totals' => [
                'tickets' => $total,
                'new' => $count('new'),
                'accepted' => $count('accepted'),
                'preparing' => $count('preparing'),
                'ready' => $count('ready'),
                'completed' => $count('completed'),
                'cancelled' => $count('cancelled'),
                'completion_rate_percent' => $total > 0 ? round($count('completed') / $total * 100, 2) : 0.0,
                'avg_accept_minutes' => $avg($t->avg_accept),
                'avg_prepare_minutes' => $avg($t->avg_prepare),
                'avg_ready_minutes' => $avg($t->avg_ready),
                'avg_complete_minutes' => $avg($t->avg_complete),
                'avg_tickets_per_day' => round($total / max(1, $r['days']), 2),
            ],
            'by_status' => $byStatus,
            'items_by_status' => $itemsByStatus,
            'by_hour' => $hourly,
            'daily' => $series,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // Customers
    // ------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    public function customers(?string $from, ?string $to, int $limit = 10): array
    {
        $r = $this->range($from, $to);
        [$start, $end] = [$r['from'], $r['to']];
        $limit = max(1, min($limit, 100));

        $live = fn () => DB::table('customers')->whereNull('customers.deleted_at');

        $topBySpend = $this->completedSales($start, $end)
            ->join('customers', 'customers.id', '=', 'sales.customer_id')
            ->groupBy('customers.id', 'customers.name', 'customers.phone', 'customers.email', 'customers.loyalty_points')
            ->orderByDesc(DB::raw('SUM(sales.grand_total)'))->orderBy('customers.id')
            ->limit($limit)
            ->selectRaw(
                'customers.id as customer_id, customers.name, customers.phone, customers.email, customers.loyalty_points, '
                .'COUNT(*) as orders, SUM(sales.grand_total) as spend, MAX(sales.sold_at) as last_order_at'
            )->get()
            ->map(fn ($row): array => [
                'customer_id' => (int) $row->customer_id,
                'name' => $row->name,
                'phone' => $row->phone,
                'email' => $row->email,
                'orders' => (int) $row->orders,
                'spend' => $this->money($row->spend),
                'average_ticket' => (int) $row->orders > 0 ? $this->money((float) $row->spend / (int) $row->orders) : 0.0,
                'last_order_at' => $row->last_order_at,
                'loyalty_points' => (int) $row->loyalty_points,
            ])->values();

        $sales = $this->completedSales($start, $end)->selectRaw(
            'COUNT(*) as orders, COALESCE(SUM(grand_total),0) as total, COUNT(DISTINCT customer_id) as customers, '
            .'COALESCE(SUM(CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END),0) as identified_orders, '
            .'COALESCE(SUM(CASE WHEN customer_id IS NOT NULL THEN grand_total ELSE 0 END),0) as identified_total'
        )->first();

        // Returning buyers = customers who bought in the period and also had a completed sale before it.
        $buyers = $this->completedSales($start, $end)->whereNotNull('sales.customer_id')->distinct()->pluck('sales.customer_id');
        $returning = $buyers->isEmpty() ? 0 : DB::table('sales')->where('status', 'completed')
            ->whereIn('customer_id', $buyers)->where('sold_at', '<', $start)->distinct()->count('customer_id');

        $newCustomers = $live()->whereBetween('customers.created_at', [$start, $end]);
        $newDaily = (clone $newCustomers)->groupBy(DB::raw('DATE(customers.created_at)'))
            ->selectRaw('DATE(customers.created_at) as day, COUNT(*) as c')->pluck('c', 'day');
        $newSeries = $this->fillDays($start, $end, fn (string $day): array => ['date' => $day, 'new_customers' => (int) ($newDaily[$day] ?? 0)]);

        $points = $live()->selectRaw(
            'COUNT(*) as customers, COALESCE(SUM(loyalty_points),0) as outstanding_points, '
            .'COALESCE(SUM(CASE WHEN loyalty_points > 0 THEN 1 ELSE 0 END),0) as with_points'
        )->first();

        $loyalty = DB::table('loyalty_transactions')->whereBetween('created_at', [$start, $end])->selectRaw(
            "COUNT(*) as transactions, COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END),0) as earned, "
            ."COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(points) ELSE 0 END),0) as redeemed, "
            ."COALESCE(SUM(CASE WHEN type = 'adjust' THEN points ELSE 0 END),0) as adjusted"
        )->first();

        $topByPoints = $live()->where('loyalty_points', '>', 0)
            ->orderByDesc('loyalty_points')->orderBy('id')->limit($limit)
            ->get(['id', 'name', 'phone', 'email', 'loyalty_points'])
            ->map(fn ($row): array => [
                'customer_id' => (int) $row->id, 'name' => $row->name, 'phone' => $row->phone, 'email' => $row->email,
                'loyalty_points' => (int) $row->loyalty_points,
            ])->values();

        return [
            'period' => $this->period($r),
            'totals' => [
                'customers' => (int) $points->customers,
                'new_customers' => (int) (clone $newCustomers)->count(),
                'buying_customers' => (int) $sales->customers,
                'returning_customers' => (int) $returning,
                'identified_orders' => (int) $sales->identified_orders,
                'identified_spend' => $this->money($sales->identified_total),
                'walk_in_orders' => (int) $sales->orders - (int) $sales->identified_orders,
                'walk_in_spend' => $this->money((float) $sales->total - (float) $sales->identified_total),
            ],
            'loyalty' => [
                'outstanding_points' => (int) $points->outstanding_points,
                'customers_with_points' => (int) $points->with_points,
                'transactions' => (int) $loyalty->transactions,
                'earned' => (int) $loyalty->earned,
                'redeemed' => (int) $loyalty->redeemed,
                'adjusted' => (int) $loyalty->adjusted,
                'top_by_points' => $topByPoints,
            ],
            'top_by_spend' => $topBySpend,
            'new_customers_daily' => $newSeries,
        ];
    }

    // ------------------------------------------------------------------------------------------
    // CSV export
    // ------------------------------------------------------------------------------------------

    /** Export report type => report method (products is an alias of dishes). */
    public const EXPORT_TYPES = ['sales', 'finance', 'dishes', 'products', 'inventory', 'purchases', 'staff', 'delivery', 'kitchen', 'customers'];

    /**
     * Flatten any report into CSV rows. Scalar groups become "key,value" sections and lists of rows
     * become tables, each introduced by a "# section.path" line and separated by a blank line.
     *
     * @return array{filename: string, rows: list<list<string|int|float|null>>}
     */
    public function export(string $type, ?string $from, ?string $to, int $limit = 10): array
    {
        $type = $type === 'products' ? 'dishes' : $type;

        $report = match ($type) {
            'sales' => $this->sales($from, $to),
            'finance' => $this->finance($from, $to),
            'dishes' => $this->dishes($from, $to, $limit),
            'inventory' => $this->inventory($from, $to),
            'purchases' => $this->purchases($from, $to),
            'staff' => $this->staff($from, $to),
            'waiters' => $this->waiters($from, $to, $limit),
            'delivery' => $this->delivery($from, $to),
            'kitchen' => $this->kitchen($from, $to),
            'customers' => $this->customers($from, $to, $limit),
            default => throw new \InvalidArgumentException("Unknown report type [{$type}]."),
        };

        // Normalise collections / nested objects into plain arrays.
        $report = json_decode((string) json_encode($report), true);
        $period = $report['period'];

        $rows = [];
        $this->flattenSection($rows, 'period', ['report' => $type] + $period);
        foreach ($report as $key => $value) {
            if ($key !== 'period') {
                $this->flattenSection($rows, (string) $key, $value);
            }
        }

        return ['filename' => "{$type}-report-{$period['from']}_{$period['to']}.csv", 'rows' => $rows];
    }

    /**
     * @param  list<list<string|int|float|null>>  $rows
     */
    private function flattenSection(array &$rows, string $path, mixed $value): void
    {
        if (! is_array($value)) {
            $this->appendBlock($rows, $path, ['key', 'value'], [[$path, $this->cell($value)]]);

            return;
        }

        if ($value === []) {
            $this->appendBlock($rows, $path, ['(no rows)'], []);

            return;
        }

        if (array_is_list($value)) {
            $columns = [];
            foreach ($value as $item) {
                foreach (is_array($item) ? $item : ['value' => $item] as $col => $cell) {
                    if (! is_array($cell) && ! in_array($col, $columns, true)) {
                        $columns[] = $col;
                    }
                }
            }
            $table = array_map(function ($item) use ($columns): array {
                $item = is_array($item) ? $item : ['value' => $item];

                return array_map(fn (string $col) => $this->cell($item[$col] ?? null), $columns);
            }, $value);
            $this->appendBlock($rows, $path, $columns, $table);

            return;
        }

        $scalars = [];
        $nested = [];
        foreach ($value as $key => $child) {
            is_array($child) ? $nested[$key] = $child : $scalars[] = [(string) $key, $this->cell($child)];
        }
        if ($scalars !== []) {
            $this->appendBlock($rows, $path, ['key', 'value'], $scalars);
        }
        foreach ($nested as $key => $child) {
            $this->flattenSection($rows, $path.'.'.$key, $child);
        }
    }

    /**
     * @param  list<list<string|int|float|null>>  $rows
     * @param  list<string>  $header
     * @param  list<list<string|int|float|null>>  $body
     */
    private function appendBlock(array &$rows, string $title, array $header, array $body): void
    {
        if ($rows !== []) {
            $rows[] = [];
        }
        $rows[] = ['# '.$title];
        $rows[] = $header;
        foreach ($body as $row) {
            $rows[] = $row;
        }
    }

    private function cell(mixed $value): string|int|float|null
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        return $value;
    }

    // ------------------------------------------------------------------------------------------
    // Overview
    // ------------------------------------------------------------------------------------------

    /**
     * Compact KPI roll-up for the reports home page. Only the requested sections are computed so a
     * caller can omit sections the user may not see.
     *
     * @param  list<string>  $sections  any of sales, inventory, purchases, finance, staff, delivery
     * @return array<string, mixed>
     */
    public function overview(?string $from, ?string $to, array $sections = ['sales', 'inventory', 'purchases', 'finance', 'staff', 'delivery']): array
    {
        $r = $this->range($from, $to);
        $f = $r['from']->toDateString();
        $t = $r['to']->toDateString();
        $out = ['period' => $this->period($r), 'sections' => array_values($sections)];

        if (in_array('sales', $sections, true)) {
            $sales = $this->sales($f, $t);
            $dishes = $this->dishes($f, $t, 5);
            $prevEnd = $r['from']->subDay()->endOfDay();
            $prevStart = $prevEnd->subDays($r['days'] - 1)->startOfDay();
            $prev = $this->salesTotals($prevStart, $prevEnd);

            $out['sales'] = [
                'total' => $sales['totals']['total'],
                'orders' => $sales['totals']['orders'],
                'average_ticket' => $sales['totals']['average_ticket'],
                'discounts' => $sales['totals']['discounts'],
                'previous_total' => $prev['total'],
                'change_percent' => (float) $prev['total'] > 0 ? round(((float) $sales['totals']['total'] - (float) $prev['total']) / (float) $prev['total'] * 100, 2) : null,
                'by_payment_method' => $sales['by_payment_method'],
                'by_order_type' => $sales['by_order_type'],
                'daily' => $sales['daily'],
                'top_dishes' => $dishes['top_by_quantity'],
            ];
        }

        if (in_array('finance', $sections, true)) {
            $fin = $this->finance($f, $t);
            $out['finance'] = [
                'sales' => $fin['totals']['sales'],
                'incomes' => $fin['totals']['incomes'],
                'expenses' => $fin['totals']['expenses'],
                'net' => $fin['totals']['net'],
                'top_expense_categories' => $fin['expenses_by_category']->take(5)->values(),
            ];
        }

        if (in_array('inventory', $sections, true)) {
            $inv = $this->inventory($f, $t);
            $out['inventory'] = [
                'valuation' => $inv['valuation']['total'],
                'low_stock_count' => $inv['stock']['low_stock_count'],
                'out_of_stock_count' => $inv['stock']['out_of_stock_count'],
                'wastage_cost' => $inv['wastage']['cost'],
            ];
        }

        if (in_array('purchases', $sections, true)) {
            $pur = $this->purchases($f, $t);
            $out['purchases'] = [
                'orders' => $pur['totals']['orders'],
                'total' => $pur['totals']['total'],
                'received_value' => $pur['totals']['received_value'],
                'outstanding_payable' => $pur['outstanding_payable'],
            ];
        }

        if (in_array('staff', $sections, true)) {
            $staff = $this->staff($f, $t);
            $out['staff'] = [
                'active_staff' => $staff['active_staff'],
                'attendance_rate_percent' => $staff['attendance']['attendance_rate_percent'],
                'present' => $staff['attendance']['present'],
                'late' => $staff['attendance']['late'],
                'absent' => $staff['attendance']['absent'],
                'leave' => $staff['attendance']['leave'],
                'leave_requests' => $staff['leaves']['requests'],
                'pending_leave_requests' => (int) (collect($staff['leaves']['by_status'])->firstWhere('status', 'pending')['requests'] ?? 0),
            ];
        }

        if (in_array('delivery', $sections, true)) {
            $del = $this->delivery($f, $t);
            $out['delivery'] = [
                'deliveries' => $del['totals']['deliveries'],
                'delivered' => $del['totals']['delivered'],
                'failed' => $del['totals']['failed'],
                'active' => $del['totals']['active'],
                'success_rate_percent' => $del['totals']['success_rate_percent'],
                'cod_collected' => $del['cod']['collected'],
                'cod_pending' => $del['cod']['pending'],
            ];
        }

        return $out;
    }

    // ------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------

    private function completedSales(CarbonImmutable $start, CarbonImmutable $end): Builder
    {
        return DB::table('sales')->where('sales.status', 'completed')->whereBetween('sales.sold_at', [$start, $end]);
    }

    private function completedSaleItems(CarbonImmutable $start, CarbonImmutable $end): Builder
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end]);
    }

    /** @param  array{from: CarbonImmutable, to: CarbonImmutable, days: int}  $range */
    private function period(array $range): array
    {
        return ['from' => $range['from']->toDateString(), 'to' => $range['to']->toDateString(), 'days' => $range['days']];
    }

    /**
     * One row per calendar day in the range so charts have no gaps.
     *
     * @param  callable(string): array<string, mixed>  $row
     * @return list<array<string, mixed>>
     */
    private function fillDays(CarbonImmutable $start, CarbonImmutable $end, callable $row): array
    {
        $days = [];
        foreach (CarbonPeriod::create($start->startOfDay(), $end->startOfDay()) as $day) {
            $days[] = $row($day->toDateString());
        }

        return $days;
    }

    private function money(mixed $value): float
    {
        return round((float) $value, 2);
    }
}
