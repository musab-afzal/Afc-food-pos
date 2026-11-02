<?php

namespace Tests\Feature;

use App\Models\Dish;
use App\Models\InventoryItem;
use App\Models\PaymentMethod;
use App\Models\Sale;
use App\Models\User;
use App\Services\CashRegisterService;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PosSaleApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_completed_sale_recalculates_total_and_consumes_recipe_stock(): void
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/pos/sales', $this->salePayload($dish->id, $cash->id));

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.grand_total', '1380.00')
            ->assertJsonPath('data.items.0.quantity', 2);
        $this->assertDatabaseHas('sales', ['uuid' => '550e8400-e29b-41d4-a716-446655440000', 'grand_total' => 1380]);
        $this->assertSame('98.0000', InventoryItem::query()->where('sku', 'ING-BUN')->value('current_stock'));
        $this->assertDatabaseCount('inventory_movements', 3);
    }

    public function test_duplicate_offline_sync_returns_existing_sale_without_duplicate_inventory_consumption(): void
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        Sanctum::actingAs($user);
        $payload = $this->salePayload($dish->id, $cash->id);

        $first = $this->postJson('/api/v1/pos/sync', $payload);
        $second = $this->postJson('/api/v1/pos/sync', $payload);

        $first->assertOk()->assertJsonPath('data.uuid', $payload['uuid']);
        $second->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
        $this->assertDatabaseCount('sales', 1);
        $this->assertDatabaseCount('inventory_movements', 3);
        $this->assertSame('98.0000', InventoryItem::query()->where('sku', 'ING-BUN')->value('current_stock'));
    }

    public function test_order_and_invoice_numbers_use_prefix_and_zero_padded_id(): void
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();

        $response = $this->postJson('/api/v1/pos/sales', $this->salePayload($dish->id, $cash->id))->assertCreated();

        $response->assertJsonPath('data.order_number', sprintf('ORD-%02d', $response->json('data.id')))
            ->assertJsonPath('data.invoice_number', sprintf('INV-%02d', $response->json('data.id')));
    }

    public function test_kitchen_ticket_only_created_when_kitchen_enabled_and_dish_is_kitchen_enabled(): void
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();

        $this->postJson('/api/v1/pos/sales', $this->salePayload($dish->id, $cash->id))->assertCreated();
        $this->assertDatabaseCount('kitchen_tickets', 1);

        $dish->update(['kitchen_enabled' => false]);
        $this->postJson('/api/v1/pos/sales', ['uuid' => '650e8400-e29b-41d4-a716-446655440000'] + $this->salePayload($dish->id, $cash->id))->assertCreated();
        $this->assertDatabaseCount('kitchen_tickets', 1);

        $dish->update(['kitchen_enabled' => true]);
        app(SettingsService::class)->set('kitchen.enabled', '0', 'boolean', 'kitchen');
        $this->postJson('/api/v1/pos/sales', ['uuid' => '750e8400-e29b-41d4-a716-446655440000'] + $this->salePayload($dish->id, $cash->id))->assertCreated();
        $this->assertDatabaseCount('kitchen_tickets', 1);
    }

    public function test_unpaid_delivery_sale_without_payments_keeps_delivery_details_and_receipt_extras(): void
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();

        $response = $this->postJson('/api/v1/pos/sales', [
            'uuid' => '550e8400-e29b-41d4-a716-446655440001',
            'order_type' => 'delivery',
            'payment_status' => 'unpaid',
            'delivery_name' => 'Ali',
            'delivery_address' => '12 Main St',
            'delivery_phone' => '03001234567',
            'processing_minutes' => 30,
            'custom_slip_message' => 'No onions',
            'notes' => 'Ring bell',
            'items' => [['dish_id' => $dish->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.paid_total', '0.00')
            ->assertJsonPath('data.processing_minutes', 30)
            ->assertJsonPath('data.custom_slip_message', 'No onions')
            ->assertJsonPath('data.delivery_name', 'Ali')
            ->assertJsonPath('data.notes', 'Ring bell');

        $this->assertDatabaseHas('deliveries', ['phone' => '03001234567', 'address' => 'Ali - 12 Main St']);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseHas('sales', ['id' => $response->json('data.id'), 'status' => 'completed']);
    }

    public function test_paid_sale_still_requires_full_payment(): void
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();

        $this->postJson('/api/v1/pos/sales', [
            'uuid' => '550e8400-e29b-41d4-a716-446655440002', 'order_type' => 'takeaway',
            'items' => [['dish_id' => $dish->id, 'quantity' => 1]],
        ])->assertUnprocessable();
    }

    public function test_cash_payment_is_recorded_on_the_open_register_immediately(): void
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        Sanctum::actingAs($user);
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        $register = app(CashRegisterService::class)->open($user, '100.00', null);

        $sale = $this->postJson('/api/v1/pos/sales', $this->salePayload($dish->id, $cash->id))->assertCreated();

        $this->assertDatabaseHas('cash_register_transactions', [
            'cash_register_id' => $register->id, 'type' => 'cash_sale', 'amount' => 1380,
            'reference_type' => Sale::class, 'reference_id' => $sale->json('data.id'),
        ]);
        $summary = app(CashRegisterService::class)->summary($register->fresh());
        $this->assertSame('1480.00', $summary['expected_closing']);
    }

    /** @return array<string, mixed> */
    private function salePayload(int $dishId, int $paymentMethodId): array
    {
        return [
            'uuid' => '550e8400-e29b-41d4-a716-446655440000',
            'order_type' => 'takeaway',
            'items' => [['dish_id' => $dishId, 'quantity' => 2, 'discount' => 0, 'addon_ids' => []]],
            'payments' => [['payment_method_id' => $paymentMethodId, 'amount' => 1380]],
        ];
    }
}
