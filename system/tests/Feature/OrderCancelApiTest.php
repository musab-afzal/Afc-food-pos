<?php

namespace Tests\Feature;

use App\Models\Dish;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderCancelApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_paid_order_within_24_hours_is_cancelled_refunded_and_restocked(): void
    {
        $order = $this->paidOrder();

        $this->postJson("/api/v1/orders/{$order->id}/cancel", ['reason' => 'Customer changed mind'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('refunds', ['sale_id' => $order->sale->id, 'amount' => 1380, 'restore_inventory' => true]);
        $this->assertSame('100.0000', InventoryItem::query()->where('sku', 'ING-BUN')->value('current_stock'));
        $this->assertDatabaseHas('order_status_history', ['order_id' => $order->id, 'to_status' => 'cancelled']);
    }

    public function test_order_older_than_24_hours_cannot_be_cancelled(): void
    {
        $order = $this->paidOrder();
        $order->update(['ordered_at' => now()->subHours(25)]);

        $this->postJson("/api/v1/orders/{$order->id}/cancel")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseCount('refunds', 0);
        $this->assertSame('completed', $order->fresh()->status);
    }

    public function test_cancelled_order_cannot_be_cancelled_again(): void
    {
        $order = $this->paidOrder();

        $this->postJson("/api/v1/orders/{$order->id}/cancel")->assertOk();
        $this->postJson("/api/v1/orders/{$order->id}/cancel")->assertUnprocessable();

        $this->assertDatabaseCount('refunds', 1);
    }

    private function paidOrder(): Order
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        $dish = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $cash = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/pos/sales', [
            'uuid' => '550e8400-e29b-41d4-a716-446655440001',
            'order_type' => 'takeaway',
            'items' => [['dish_id' => $dish->id, 'quantity' => 2, 'discount' => 0, 'addon_ids' => []]],
            'payments' => [['payment_method_id' => $cash->id, 'amount' => 1380]],
        ])->assertCreated();

        return Order::query()->with('sale')->latest('id')->firstOrFail();
    }
}
