<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Dish;
use App\Models\DishVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DealApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_deal_can_be_created_with_products_and_price(): void
    {
        [$burger, $other] = $this->actingAsAdminWithDishes();

        $response = $this->postJson('/api/v1/deals', [
            'name' => 'Lunch Combo',
            'price' => 999,
            'is_active' => true,
            'items' => [
                ['dish_id' => $burger->id, 'quantity' => 2],
                ['dish_id' => $other->id, 'quantity' => 1],
            ],
        ]);

        $expectedRegular = number_format((float) $burger->base_price * 2 + (float) $other->base_price, 2, '.', '');
        $response->assertCreated()
            ->assertJsonPath('data.name', 'Lunch Combo')
            ->assertJsonPath('data.price', '999.00')
            ->assertJsonPath('data.regular_price', $expectedRegular)
            ->assertJsonCount(2, 'data.items');
        $this->assertDatabaseCount('deal_items', 2);
    }

    public function test_deal_can_be_deactivated_and_reactivated(): void
    {
        [$burger] = $this->actingAsAdminWithDishes();
        $deal = Deal::query()->create(['name' => 'Solo', 'price' => 500, 'is_active' => true]);
        $deal->items()->create(['dish_id' => $burger->id, 'quantity' => 1]);

        $this->patchJson("/api/v1/deals/{$deal->id}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
        $this->getJson('/api/v1/deals?is_active=0')->assertOk()->assertJsonPath('data.0.id', $deal->id);
        $this->patchJson("/api/v1/deals/{$deal->id}/toggle")->assertOk()->assertJsonPath('data.is_active', true);
    }

    public function test_updating_a_deal_replaces_its_products(): void
    {
        [$burger, $other] = $this->actingAsAdminWithDishes();
        $deal = Deal::query()->create(['name' => 'Solo', 'price' => 500, 'is_active' => true]);
        $deal->items()->create(['dish_id' => $burger->id, 'quantity' => 1]);

        $this->putJson("/api/v1/deals/{$deal->id}", [
            'name' => 'Solo Plus',
            'price' => 650,
            'is_active' => true,
            'items' => [['dish_id' => $other->id, 'quantity' => 3]],
        ])->assertOk()->assertJsonPath('data.items.0.dish_id', $other->id);

        $this->assertDatabaseCount('deal_items', 1);
    }

    public function test_deal_requires_at_least_one_product_and_matching_size(): void
    {
        [$burger, $other] = $this->actingAsAdminWithDishes();
        $variant = DishVariant::query()->create(['dish_id' => $other->id, 'name' => 'Large', 'sku' => 'TEST-LARGE', 'price' => 900, 'is_active' => true]);

        $this->postJson('/api/v1/deals', ['name' => 'Empty', 'price' => 100, 'is_active' => true, 'items' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->postJson('/api/v1/deals', [
            'name' => 'Mismatch',
            'price' => 100,
            'is_active' => true,
            'items' => [['dish_id' => $burger->id, 'dish_variant_id' => $variant->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.dish_variant_id');
    }

    /** @return array{0: Dish, 1: Dish} */
    private function actingAsAdminWithDishes(): array
    {
        $this->seed();
        Sanctum::actingAs(User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail());

        $burger = Dish::query()->where('sku', 'DSH-BURGER-01')->firstOrFail();
        $other = Dish::query()->whereKeyNot($burger->id)->first() ?? Dish::factory()->create();

        return [$burger, $other];
    }
}
