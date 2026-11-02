<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\Category;
use App\Models\Dish;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\PaymentMethod;
use App\Models\Recipe;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            SettingsSeeder::class,
            FinanceSeeder::class,
        ]);

        $adminPassword = env('SEED_ADMIN_PASSWORD');
        if (blank($adminPassword)) {
            throw new RuntimeException('SEED_ADMIN_PASSWORD must be set before running the development seeder.');
        }

        $admin = User::query()->updateOrCreate(
            ['email' => env('SEED_ADMIN_EMAIL', 'admin@example.com')],
            [
                'name' => 'Restaurant Admin',
                'password' => $adminPassword,
                'is_active' => true,
                'status' => 'active',
            ],
        );
        $superAdminRoleId = Role::query()->where('slug', 'super_admin')->value('id')
            ?? Role::query()->where('slug', 'admin')->value('id');
        if ($superAdminRoleId) {
            $admin->roles()->sync([$superAdminRoleId]);
        }

        $categories = collect(['Burgers', 'Pizza', 'Drinks', 'Desserts'])->mapWithKeys(function (string $name): array {
            $category = Category::query()->updateOrCreate(['slug' => Str::slug($name)], ['name' => $name, 'is_active' => true]);

            return [$name => $category];
        });

        foreach ([
            ['name' => 'Cash', 'code' => 'cash', 'offline' => true],
            ['name' => 'Card', 'code' => 'card', 'offline' => false],
            ['name' => 'EasyPaisa', 'code' => 'easypaisa', 'offline' => false],
            ['name' => 'JazzCash', 'code' => 'jazzcash', 'offline' => false],
        ] as $index => $method) {
            PaymentMethod::query()->updateOrCreate(
                ['code' => $method['code']],
                ['name' => $method['name'], 'is_active' => true, 'works_offline' => $method['offline'], 'requires_reference' => $method['code'] !== 'cash', 'sort_order' => $index],
            );
        }

        foreach (range(1, 8) as $number) {
            RestaurantTable::query()->updateOrCreate(
                ['name' => 'Table '.$number],
                ['capacity' => $number <= 4 ? 4 : 6, 'table_number' => (string) $number, 'shape' => 'square', 'qr_token' => (string) Str::uuid(), 'status' => 'available', 'sort_order' => $number, 'is_active' => true],
            );
        }

        $ingredientCategory = InventoryCategory::query()->updateOrCreate(['name' => 'Ingredients'], ['is_active' => true]);
        $bun = InventoryItem::query()->updateOrCreate(['sku' => 'ING-BUN'], ['inventory_category_id' => $ingredientCategory->id, 'name' => 'Burger Bun', 'unit' => 'piece', 'current_stock' => 100, 'minimum_stock' => 10, 'reorder_level' => 20, 'average_cost' => 35, 'latest_purchase_cost' => 35, 'is_active' => true]);
        $patty = InventoryItem::query()->updateOrCreate(['sku' => 'ING-PATTY'], ['inventory_category_id' => $ingredientCategory->id, 'name' => 'Chicken Patty', 'unit' => 'piece', 'current_stock' => 100, 'minimum_stock' => 10, 'reorder_level' => 20, 'average_cost' => 110, 'latest_purchase_cost' => 110, 'is_active' => true]);
        $cheese = InventoryItem::query()->updateOrCreate(['sku' => 'ING-CHEESE'], ['inventory_category_id' => $ingredientCategory->id, 'name' => 'Cheese Slice', 'unit' => 'piece', 'current_stock' => 100, 'minimum_stock' => 10, 'reorder_level' => 20, 'average_cost' => 45, 'latest_purchase_cost' => 45, 'is_active' => true]);

        $burger = Dish::query()->updateOrCreate(['sku' => 'DSH-BURGER-01'], ['category_id' => $categories['Burgers']->id, 'name' => 'Smoky Chicken Burger', 'slug' => 'smoky-chicken-burger', 'short_description' => 'Grilled chicken, crisp lettuce and house sauce', 'base_price' => 690, 'tax_percent' => 0, 'preparation_minutes' => 12, 'is_active' => true, 'is_available' => true, 'pos_enabled' => true]);
        $recipe = Recipe::query()->updateOrCreate(['dish_id' => $burger->id, 'dish_variant_id' => null], ['name' => 'Standard burger recipe']);
        foreach ([[$bun, 1], [$patty, 1], [$cheese, 1]] as [$item, $quantity]) {
            $recipe->items()->updateOrCreate(['inventory_item_id' => $item->id], ['quantity' => $quantity, 'unit' => 'piece', 'wastage_percent' => 0]);
        }
        $extraCheese = Addon::query()->updateOrCreate(['name' => 'Extra Cheese'], ['price' => 120, 'cost' => 45, 'is_active' => true]);
        $burger->addons()->syncWithoutDetaching([$extraCheese->id]);

        foreach ([
            ['name' => 'Margherita Pizza', 'sku' => 'DSH-PIZZA-01', 'category' => 'Pizza', 'price' => 1190],
            ['name' => 'Classic Cola', 'sku' => 'DSH-DRINK-01', 'category' => 'Drinks', 'price' => 180],
            ['name' => 'Chocolate Lava Cake', 'sku' => 'DSH-DESSERT-01', 'category' => 'Desserts', 'price' => 520],
        ] as $dish) {
            Dish::query()->updateOrCreate(['sku' => $dish['sku']], ['category_id' => $categories[$dish['category']]->id, 'name' => $dish['name'], 'slug' => Str::slug($dish['name']), 'base_price' => $dish['price'], 'tax_percent' => 0, 'preparation_minutes' => 10, 'is_active' => true, 'is_available' => true, 'pos_enabled' => true]);
        }

        $this->call(StaffOperationsSeeder::class);
        $this->call(PromotionsSeeder::class);

        $this->command?->info('Development admin: '.env('SEED_ADMIN_EMAIL', 'admin@example.com'));
    }
}
