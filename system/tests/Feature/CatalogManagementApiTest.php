<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CatalogManagementApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_returns_403_when_user_lacks_menu_permission(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/categories')->assertForbidden();
    }

    public function test_category_list_supports_search_status_filter_and_pagination(): void
    {
        $this->actingAsAdmin();
        Category::factory()->create(['name' => 'Seasonal Specials', 'slug' => 'seasonal-specials', 'is_active' => true]);
        Category::factory()->create(['name' => 'Archived Specials', 'slug' => 'archived-specials', 'is_active' => false]);

        $response = $this->getJson('/api/v1/categories?search=Seasonal&is_active=1&per_page=5');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Seasonal Specials')
            ->assertJsonPath('meta.per_page', 5);
    }

    public function test_valid_payload_creates_dish_and_activity_log_and_returns_201(): void
    {
        $this->actingAsAdmin();
        $category = Category::factory()->create(['is_active' => true]);

        $response = $this->postJson('/api/v1/dishes', $this->dishPayload($category->id));

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Charred Chicken Bowl')
            ->assertJsonPath('data.category.id', $category->id);
        $this->assertDatabaseHas('dishes', ['sku' => 'DSH-BOWL-01', 'base_price' => 850]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'dish.created', 'module' => 'menu']);
    }

    public function test_returns_422_when_dish_payload_is_invalid(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/dishes', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['category_id', 'name', 'slug', 'sku', 'base_price']);
        $this->assertDatabaseMissing('dishes', ['sku' => 'DSH-BOWL-01']);
    }

    public function test_archive_preserves_dish_and_disables_sales_channels(): void
    {
        $this->actingAsAdmin();
        $category = Category::factory()->create();
        $createResponse = $this->postJson('/api/v1/dishes', $this->dishPayload($category->id));
        $dishId = $createResponse->json('data.id');

        $response = $this->deleteJson("/api/v1/dishes/{$dishId}");

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('dishes', ['id' => $dishId, 'is_active' => false, 'is_available' => false, 'pos_enabled' => false]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'dish.archived', 'subject_id' => $dishId]);
    }

    private function actingAsAdmin(): User
    {
        $this->seed();
        $user = User::query()->where('email', env('SEED_ADMIN_EMAIL'))->firstOrFail();
        Sanctum::actingAs($user);

        return $user;
    }

    /** @return array<string, mixed> */
    private function dishPayload(int $categoryId): array
    {
        return [
            'category_id' => $categoryId,
            'brand_id' => null,
            'name' => 'Charred Chicken Bowl',
            'slug' => 'charred-chicken-bowl',
            'sku' => 'DSH-BOWL-01',
            'barcode' => null,
            'description' => 'Chicken, grains and vegetables.',
            'short_description' => 'A balanced grilled chicken bowl.',
            'image' => null,
            'base_price' => 850,
            'tax_percent' => 0,
            'preparation_minutes' => 12,
            'is_active' => true,
            'is_available' => true,
            'dine_in_enabled' => true,
            'takeaway_enabled' => true,
            'delivery_enabled' => true,
            'qr_enabled' => true,
            'pos_enabled' => true,
            'kitchen_enabled' => true,
            'sort_order' => 10,
            'current_stock' => 999999,
        ];
    }
}
