<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Customer;
use App\Models\Dish;
use App\Models\Expense;
use App\Models\InventoryItem;
use App\Models\Refund;
use App\Models\Sale;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Super Admin bulk "danger zone" operations. Every delete runs in one transaction.
 *
 * Models that use SoftDeletes (customers, dishes, inventory items) are soft deleted; the rest
 * are hard deleted with their children removed first so foreign keys never block the delete.
 */
class BulkDataService
{
    public function __construct(private readonly LedgerService $ledger) {}

    /** All orders, their sales/payments/refunds, kitchen tickets, deliveries and drawer entries. */
    public function deleteOrders(): int
    {
        return DB::transaction(function (): int {
            $count = DB::table('orders')->count();

            // Refunds restrict their sale and sale items, so they go first.
            DB::table('refund_items')->delete();
            DB::table('refunds')->delete();
            DB::table('cash_register_transactions')->whereIn('reference_type', [Sale::class, Refund::class])->delete();
            DB::table('financial_transactions')->whereIn('reference_type', [Sale::class, Refund::class])->delete();

            DB::table('coupon_usages')->update(['order_id' => null, 'sale_id' => null]);
            DB::table('sale_item_addons')->delete();
            DB::table('sale_items')->delete();
            DB::table('payments')->delete();
            DB::table('sales')->delete();

            $this->deleteKitchenTickets();
            DB::table('order_item_addons')->delete();
            DB::table('order_items')->delete();
            DB::table('order_status_history')->delete();
            DB::table('rider_assignments')->delete();
            DB::table('deliveries')->delete();
            DB::table('orders')->delete();

            // Nothing is being served any more, so release tables held by those orders.
            DB::table('restaurant_tables')->whereIn('status', ['occupied', 'cleaning'])->update(['status' => 'available']);

            return $count;
        });
    }

    /** Customers are soft deleted so historical sales and loyalty records stay intact. */
    public function deleteCustomers(): int
    {
        return DB::transaction(fn (): int => (int) Customer::query()->delete());
    }

    /** Dishes are soft deleted; variants, recipes, add-on/modifier links, images and deals built from them are removed. */
    public function deleteProducts(): int
    {
        return DB::transaction(function (): int {
            DB::table('deal_items')->delete();
            DB::table('deals')->delete();
            DB::table('recipe_items')->delete();
            DB::table('recipes')->delete();
            DB::table('addon_dish')->delete();
            DB::table('dish_modifier_group')->delete();
            DB::table('dish_images')->delete();
            DB::table('dish_variants')->delete();

            return (int) Dish::query()->delete();
        });
    }

    public function deleteKitchenOrders(): int
    {
        return DB::transaction(function (): int {
            $count = DB::table('kitchen_tickets')->count();
            $this->deleteKitchenTickets();

            return $count;
        });
    }

    /** Ingredients are soft deleted; recipe lines pointing at them are removed so POS recipes keep working. */
    public function deleteIngredients(): int
    {
        return DB::transaction(function (): int {
            DB::table('recipe_items')->delete();

            return (int) InventoryItem::query()->delete();
        });
    }

    /** Expenses (with their ledger and drawer entries) and then all expense categories. */
    public function deleteExpenses(): int
    {
        return DB::transaction(function (): int {
            $count = 0;

            Expense::query()->orderBy('id')->chunkById(200, function (Collection $expenses) use (&$count): void {
                foreach ($expenses as $expense) {
                    $this->ledger->removeForReference($expense); // also reverts the linked account balance
                    $count++;
                }
            });

            DB::table('cash_register_transactions')->where('reference_type', Expense::class)->delete();
            DB::table('expenses')->delete();
            DB::table('expense_categories')->delete();

            return $count;
        });
    }

    /** Accounts together with their manual balance adjustments; remaining ledger entries are detached. */
    public function deleteAccounts(): int
    {
        return DB::transaction(function (): int {
            $count = DB::table('accounts')->count();

            DB::table('financial_transactions')->where('reference_type', Account::class)->delete();
            DB::table('financial_transactions')->whereNotNull('account_id')->update(['account_id' => null]);
            DB::table('accounts')->delete();

            return $count;
        });
    }

    /**
     * @param  array{date_from?: ?string, date_to?: ?string, limit?: ?int}  $filters
     * @return list<array<string, mixed>>
     */
    public function ordersForPrint(array $filters = []): array
    {
        return DB::table('orders')
            ->leftJoin('customers', 'customers.id', '=', 'orders.customer_id')
            ->leftJoin('restaurant_tables', 'restaurant_tables.id', '=', 'orders.restaurant_table_id')
            ->when(! empty($filters['date_from']), fn ($query) => $query->whereDate('orders.ordered_at', '>=', $filters['date_from']))
            ->when(! empty($filters['date_to']), fn ($query) => $query->whereDate('orders.ordered_at', '<=', $filters['date_to']))
            ->orderByDesc('orders.ordered_at')->orderByDesc('orders.id')
            ->limit($this->limit($filters))
            ->get([
                'orders.id', 'orders.order_number', 'orders.source', 'orders.order_type', 'orders.status', 'orders.payment_status',
                'customers.name as customer_name', 'restaurant_tables.name as table_name',
                'orders.subtotal', 'orders.discount_total', 'orders.tax_total', 'orders.service_charge',
                'orders.delivery_charge', 'orders.grand_total', 'orders.ordered_at',
                DB::raw('(select count(*) from order_items where order_items.order_id = orders.id) as items_count'),
            ])
            ->map(fn ($row): array => (array) $row)->all();
    }

    /**
     * @param  array{limit?: ?int}  $filters
     * @return list<array<string, mixed>>
     */
    public function customersForPrint(array $filters = []): array
    {
        return Customer::query()
            ->orderBy('name')
            ->limit($this->limit($filters))
            ->get(['id', 'customer_code', 'name', 'phone', 'email', 'address', 'city', 'loyalty_points', 'balance', 'is_active'])
            ->toArray();
    }

    /**
     * @param  array{limit?: ?int}  $filters
     * @return list<array<string, mixed>>
     */
    public function productsForPrint(array $filters = []): array
    {
        return Dish::query()
            ->with('category:id,name')
            ->orderBy('name')
            ->limit($this->limit($filters))
            ->get(['id', 'category_id', 'name', 'sku', 'base_price', 'tax_percent', 'is_active', 'is_available'])
            ->map(fn (Dish $dish): array => [
                'id' => $dish->id,
                'name' => $dish->name,
                'sku' => $dish->sku,
                'category' => $dish->category?->name,
                'base_price' => $dish->base_price,
                'tax_percent' => $dish->tax_percent,
                'is_active' => $dish->is_active,
                'is_available' => $dish->is_available,
            ])->values()->all();
    }

    private function deleteKitchenTickets(): void
    {
        DB::table('kitchen_ticket_items')->delete();
        DB::table('kitchen_tickets')->delete();
    }

    /** @param  array{limit?: ?int}  $filters */
    private function limit(array $filters): int
    {
        return max(1, min((int) ($filters['limit'] ?? 5000), 20000));
    }
}
