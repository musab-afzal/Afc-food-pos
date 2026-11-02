<?php

namespace Database\Seeders;

use App\Models\Coupon;
use App\Models\Discount;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PromotionsSeeder extends Seeder
{
    private const PERMISSIONS = [
        'discounts.view', 'discounts.manage',
        'promotions.view', 'promotions.manage', 'coupons.manage', 'loyalty.manage',
    ];

    /** Idempotent: safe to run repeatedly and on databases that were seeded before Phase 12. */
    public function run(): void
    {
        foreach (self::PERMISSIONS as $slug) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => Str::headline(str_replace('.', ' ', $slug)), 'module' => 'Promotions'],
            );
        }

        // Additive only: never strips permissions that were customised on a role.
        $ids = Permission::query()->whereIn('slug', self::PERMISSIONS)->pluck('id');
        Role::query()->whereIn('slug', ['super_admin', 'admin', 'manager'])->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($ids));

        if (Discount::query()->doesntExist()) {
            Discount::query()->create([
                'name' => 'Weekend Special 10%', 'type' => 'percent', 'value' => 10, 'applies_to' => 'order',
                'min_order' => 1000, 'max_discount' => 500, 'is_active' => true,
            ]);
            Discount::query()->create([
                'name' => 'Flat 100 Off Large Orders', 'type' => 'fixed', 'value' => 100, 'applies_to' => 'order',
                'min_order' => 1500, 'is_active' => true,
            ]);
        }

        if (Coupon::query()->doesntExist()) {
            Coupon::query()->create([
                'code' => 'WELCOME10', 'name' => 'Welcome 10% Off', 'type' => 'percent', 'value' => 10,
                'min_order' => 500, 'max_discount' => 300,
                'start_date' => now()->toDateString(), 'expiry_date' => now()->addYear()->toDateString(),
                'total_usage_limit' => null, 'per_customer_limit' => 1, 'used_count' => 0, 'is_active' => true,
            ]);
        }
    }
}
