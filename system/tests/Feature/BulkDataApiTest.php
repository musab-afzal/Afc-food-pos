<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Dish;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BulkDataApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_only_super_admin_can_use_bulk_endpoints(): void
    {
        $this->seed();
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('slug', 'admin')->value('id'));
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/bulk/delete-orders')->assertForbidden();
        $this->getJson('/api/v1/admin/bulk/print-orders')->assertForbidden();
        $this->assertFalse(Role::query()->where('slug', 'admin')->first()->permissions()->where('slug', 'like', 'data.%')->exists());
    }

    public function test_super_admin_can_bulk_delete_and_print(): void
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        Sanctum::actingAs($user);
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        $this->postJson('/api/v1/pos/sales', [
            'uuid' => '550e8400-e29b-41d4-a716-446655440010', 'order_type' => 'takeaway',
            'items' => [['dish_id' => $dish->id, 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cash->id, 'amount' => 1000]],
        ])->assertCreated();

        $this->getJson('/api/v1/admin/bulk/print-orders')->assertOk()->assertJsonPath('data.total', 1);
        $this->getJson('/api/v1/admin/bulk/print-products')->assertOk()->assertJsonPath('data.rows.0.category', fn ($value) => is_string($value));
        $this->getJson('/api/v1/admin/bulk/print-customers')->assertOk();

        $password = ['password' => env('SEED_ADMIN_PASSWORD')];

        $this->postJson('/api/v1/admin/bulk/delete-kitchen-orders')->assertUnprocessable();
        $this->postJson('/api/v1/admin/bulk/delete-kitchen-orders', ['password' => 'wrong-password'])->assertUnprocessable();
        $this->postJson('/api/v1/admin/bulk/delete-kitchen-orders', $password)->assertOk()->assertJsonPath('data.deleted', 1);
        $this->postJson('/api/v1/admin/bulk/delete-orders', $password)->assertOk()->assertJsonPath('data.deleted', 1);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('payments', 0);

        $this->postJson('/api/v1/admin/bulk/delete-products', $password)->assertOk();
        $this->assertSame(0, Dish::query()->count());
        $this->postJson('/api/v1/admin/bulk/delete-ingredients', $password)->assertOk();
        $this->postJson('/api/v1/admin/bulk/delete-customers', $password)->assertOk();
        $this->assertSame(0, Customer::query()->count());
        $this->postJson('/api/v1/admin/bulk/delete-expenses', $password)->assertOk();
        $this->postJson('/api/v1/admin/bulk/delete-accounts', $password)->assertOk();
        $this->assertDatabaseCount('accounts', 0);
        $this->assertDatabaseCount('expense_categories', 0);
    }
}
