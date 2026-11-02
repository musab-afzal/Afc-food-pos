<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BulkDataService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Super Admin only (routes are behind `super_admin_only`): bulk delete and print-list endpoints. */
class BulkDataController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly BulkDataService $bulk) {}

    public function deleteOrders(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'orders', $this->bulk->deleteOrders());
    }

    public function deleteCustomers(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'customers', $this->bulk->deleteCustomers());
    }

    public function deleteProducts(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'products', $this->bulk->deleteProducts());
    }

    public function deleteKitchenOrders(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'kitchen orders', $this->bulk->deleteKitchenOrders());
    }

    public function deleteIngredients(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'ingredients', $this->bulk->deleteIngredients());
    }

    public function deleteExpenses(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'expenses', $this->bulk->deleteExpenses());
    }

    public function deleteAccounts(Request $request): JsonResponse
    {
        $this->assertLoginPassword($request);

        return $this->deleted($request, 'accounts', $this->bulk->deleteAccounts());
    }

    /** Require the signed-in user's login password before any bulk wipe. */
    private function assertLoginPassword(Request $request): void
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);
    }

    public function printOrders(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20000'],
        ]);

        return $this->printable('Orders', $this->bulk->ordersForPrint($filters));
    }

    public function printCustomers(Request $request): JsonResponse
    {
        $filters = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:20000']]);

        return $this->printable('Customers', $this->bulk->customersForPrint($filters));
    }

    public function printProducts(Request $request): JsonResponse
    {
        $filters = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:20000']]);

        return $this->printable('Products', $this->bulk->productsForPrint($filters));
    }

    private function deleted(Request $request, string $label, int $count): JsonResponse
    {
        DB::table('activity_logs')->insert([
            'user_id' => $request->user()?->id,
            'action' => 'bulk.delete_'.str_replace(' ', '_', $label),
            'module' => 'bulk_data',
            'after_data' => json_encode(['deleted' => $count]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $this->success(ucfirst($label)." deleted ({$count}).", ['deleted' => $count]);
    }

    /** @param  list<array<string, mixed>>  $rows */
    private function printable(string $title, array $rows): JsonResponse
    {
        return $this->success("{$title} list retrieved.", [
            'title' => $title,
            'generated_at' => now()->toIso8601String(),
            'total' => count($rows),
            'rows' => $rows,
        ]);
    }
}
