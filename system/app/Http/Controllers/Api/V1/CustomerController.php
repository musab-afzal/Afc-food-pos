<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertCustomerRequest;
use App\Models\Customer;
use App\Models\LoyaltyTransaction;
use App\Models\Sale;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'customer_group_id' => ['nullable', 'integer', 'exists:customer_groups,id'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,customer_code,created_at,loyalty_points'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $customers = Customer::query()
            ->with('group:id,name,discount_percent')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('phone', 'like', $search)
                    ->orWhere('email', 'like', $search)
                    ->orWhere('customer_code', 'like', $search));
            })
            ->when($request->filled('customer_group_id'), fn ($query) => $query->where('customer_group_id', $request->integer('customer_group_id')))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Customers retrieved.', $customers);
    }

    public function store(UpsertCustomerRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $customer = DB::transaction(function () use ($request, $activityLogger): Customer {
            $data = $request->validated();
            $data['customer_code'] = $data['customer_code'] ?? $this->nextCustomerCode();
            $data['loyalty_points'] = $data['loyalty_points'] ?? 0;
            $data['credit_limit'] = $data['credit_limit'] ?? 0;
            $data['balance'] = $data['balance'] ?? 0;

            $customer = Customer::query()->create($data);
            $activityLogger->log($request, 'customer.created', 'customers', $customer, after: $customer->toArray());

            return $customer;
        });

        return $this->success('Customer created.', $customer->load('group:id,name,discount_percent'), 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer->load('group:id,name,discount_percent,description');

        $ordersCount = Sale::query()->where('customer_id', $customer->id)->count();
        $salesSum = (float) Sale::query()->where('customer_id', $customer->id)->sum('grand_total');

        return $this->success('Customer retrieved.', array_merge($customer->toArray(), [
            'totals' => [
                'orders_count' => $ordersCount,
                'sales_sum' => round($salesSum, 2),
            ],
            'loyalty_points' => $customer->loyalty_points,
        ]));
    }

    public function update(UpsertCustomerRequest $request, Customer $customer, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $customer->toArray();
        DB::transaction(function () use ($request, $customer, $activityLogger, $before): void {
            $customer->update($request->validated());
            $activityLogger->log($request, 'customer.updated', 'customers', $customer, $before, $customer->fresh()->toArray());
        });

        return $this->success('Customer updated.', $customer->fresh()->load('group:id,name,discount_percent'));
    }

    public function destroy(Request $request, Customer $customer, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('customers.delete')) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        $before = $customer->toArray();
        DB::transaction(function () use ($request, $customer, $activityLogger, $before): void {
            $customer->update(['is_active' => false]);
            $customer->delete();
            $activityLogger->log($request, 'customer.deleted', 'customers', $customer, $before, ['deleted' => true]);
        });

        return $this->success('Customer deleted.');
    }

    public function ledger(Request $request, Customer $customer): JsonResponse
    {
        $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = $request->integer('per_page', 25);

        $sales = Sale::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('sold_at')
            ->orderByDesc('id')
            ->limit($perPage)
            ->get([
                'id',
                'invoice_number',
                'status',
                'grand_total',
                'paid_total',
                'sold_at',
                'created_at',
            ])
            ->map(fn (Sale $sale) => [
                'type' => 'sale',
                'id' => $sale->id,
                'reference' => $sale->invoice_number,
                'status' => $sale->status,
                'amount' => $sale->grand_total,
                'points' => null,
                'occurred_at' => $sale->sold_at ?? $sale->created_at,
            ]);

        $loyalty = LoyaltyTransaction::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($perPage)
            ->get()
            ->map(fn (LoyaltyTransaction $tx) => [
                'type' => 'loyalty',
                'id' => $tx->id,
                'reference' => $tx->type,
                'status' => null,
                'amount' => null,
                'points' => $tx->points,
                'balance_after' => $tx->balance_after,
                'notes' => $tx->notes,
                'occurred_at' => $tx->created_at,
            ]);

        $entries = $sales->concat($loyalty)
            ->sortByDesc(fn (array $row) => (string) $row['occurred_at'])
            ->values()
            ->take($perPage);

        return $this->success('Customer ledger retrieved.', [
            'customer_id' => $customer->id,
            'loyalty_points' => $customer->loyalty_points,
            'entries' => $entries,
        ]);
    }

    private function nextCustomerCode(): string
    {
        $year = now()->format('Y');
        $prefix = 'CUST-'.$year.'-';

        $latest = Customer::query()
            ->withTrashed()
            ->where('customer_code', 'like', $prefix.'%')
            ->orderByDesc('customer_code')
            ->value('customer_code');

        $sequence = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);
    }
}
