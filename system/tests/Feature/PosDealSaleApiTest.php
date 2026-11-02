<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Dish;
use App\Models\InventoryItem;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PosDealSaleApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_active_deal_is_listed_in_pos_catalog(): void
    {
        $deal = $this->burgerDeal();

        $this->getJson('/api/v1/pos/catalog')
            ->assertOk()
            ->assertJsonPath('data.deals.0.id', $deal->id)
            ->assertJsonPath('data.deals.0.components.0.share_cents', 100000);
    }

    public function test_deal_is_sold_as_its_dishes_at_the_deal_price(): void
    {
        $deal = $this->burgerDeal();

        $response = $this->postJson('/api/v1/pos/sales', $this->salePayload($deal->id, 1000));

        $response->assertCreated()->assertJsonPath('data.grand_total', '1000.00');
        $this->assertDatabaseHas('sale_items', ['deal_id' => $deal->id, 'deal_name' => 'Burger Duo', 'quantity' => 2, 'total' => 1000]);
        $this->assertDatabaseHas('order_items', ['deal_id' => $deal->id, 'quantity' => 2]);
        $this->assertDatabaseCount('kitchen_ticket_items', 1);
        $this->assertSame('98.0000', InventoryItem::query()->where('sku', 'ING-BUN')->value('current_stock'));
    }

    public function test_inactive_deal_cannot_be_sold(): void
    {
        $deal = $this->burgerDeal();
        $deal->update(['is_active' => false]);

        $this->getJson('/api/v1/pos/catalog')->assertOk()->assertJsonCount(0, 'data.deals');
        $this->postJson('/api/v1/pos/sales', $this->salePayload($deal->id, 1000))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('deals.0.deal_id');
    }

    private function burgerDeal(): Deal
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());
        $burger = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();

        $deal = Deal::query()->create(['name' => 'Burger Duo', 'price' => 1000, 'is_active' => true]);
        $deal->items()->create(['dish_id' => $burger->id, 'quantity' => 2]);

        return $deal;
    }

    /** @return array<string, mixed> */
    private function salePayload(int $dealId, float $amount): array
    {
        return [
            'uuid' => '550e8400-e29b-41d4-a716-446655440002',
            'order_type' => 'takeaway',
            'deals' => [['deal_id' => $dealId, 'quantity' => 1]],
            'payments' => [['payment_method_id' => PaymentMethod::query()->where('code', 'cash')->value('id'), 'amount' => $amount]],
        ];
    }
}
