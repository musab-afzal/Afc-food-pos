<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissionDefinitions = [
            'dashboard.view' => 'Dashboard',

            'pos.access' => 'POS',
            'pos.create_sale' => 'POS',
            'pos.discount' => 'POS',
            'pos.cancel_item' => 'POS',
            'pos.cancel_sale' => 'POS',
            'pos.hold_order' => 'POS',
            'pos.refund' => 'POS',

            'orders.view' => 'Orders',
            'orders.create' => 'Orders',
            'orders.update' => 'Orders',
            'orders.cancel' => 'Orders',
            'orders.assign_rider' => 'Orders',

            'kitchen.view' => 'Kitchen',
            'kitchen.accept' => 'Kitchen',
            'kitchen.ready' => 'Kitchen',
            'kitchen.complete' => 'Kitchen',

            'tables.view' => 'Tables',
            'tables.manage' => 'Tables',
            'tables.reservations' => 'Tables',

            'menu.view' => 'Menu',
            'menu.create' => 'Menu',
            'menu.edit' => 'Menu',
            'menu.delete' => 'Menu',

            'recipes.view' => 'Recipes',
            'recipes.manage' => 'Recipes',

            'inventory.view' => 'Inventory',
            'inventory.create' => 'Inventory',
            'inventory.edit' => 'Inventory',
            'inventory.adjust' => 'Inventory',
            'inventory.purchase' => 'Inventory',
            'inventory.wastage' => 'Inventory',

            'purchases.view' => 'Purchases',
            'purchases.create' => 'Purchases',
            'purchases.edit' => 'Purchases',
            'purchases.approve' => 'Purchases',

            'suppliers.view' => 'Suppliers',
            'suppliers.manage' => 'Suppliers',

            'customers.view' => 'Customers',
            'customers.create' => 'Customers',
            'customers.edit' => 'Customers',
            'customers.delete' => 'Customers',
            'customers.loyalty' => 'Customers',

            'riders.view' => 'Riders',
            'riders.manage' => 'Riders',
            'riders.settle' => 'Riders',

            'staff.view' => 'Staff',
            'staff.create' => 'Staff',
            'staff.edit' => 'Staff',
            'staff.delete' => 'Staff',

            'attendance.view' => 'Attendance',
            'attendance.manage' => 'Attendance',
            'attendance.approve' => 'Attendance',

            'finance.view' => 'Finance',
            'finance.expense' => 'Finance',
            'finance.income' => 'Finance',
            'finance.payment' => 'Finance',
            'finance.accounts' => 'Finance',
            'finance.cash_register' => 'Finance',

            'expenses.view' => 'Expenses',
            'expenses.manage' => 'Expenses',

            'reports.view' => 'Reports',
            'reports.export' => 'Reports',
            'reports.sales' => 'Reports',
            'reports.inventory' => 'Reports',
            'reports.finance' => 'Reports',
            'reports.staff' => 'Reports',
            'reports.kitchen' => 'Reports',
            'reports.customers' => 'Reports',
            'reports.purchases' => 'Reports',
            'reports.delivery' => 'Reports',
            'reports.overview' => 'Reports',
            'discounts.view' => 'Promotions',
            'discounts.manage' => 'Promotions',
            'promotions.view' => 'Promotions',
            'promotions.manage' => 'Promotions',
            'coupons.manage' => 'Promotions',
            'loyalty.manage' => 'Promotions',

            'settings.view' => 'Settings',
            'settings.manage' => 'Settings',

            'activity_logs.view' => 'Activity Logs',
            'notifications.view' => 'Notifications',
            'notifications.manage' => 'Notifications',

            // Bulk destructive actions and data prints — Super Admin only.
            'data.delete_orders' => 'Danger Zone',
            'data.delete_customers' => 'Danger Zone',
            'data.delete_products' => 'Danger Zone',
            'data.delete_kitchen_orders' => 'Danger Zone',
            'data.delete_ingredients' => 'Danger Zone',
            'data.delete_expenses' => 'Danger Zone',
            'data.delete_accounts' => 'Danger Zone',
            'data.print_orders' => 'Danger Zone',
            'data.print_customers' => 'Danger Zone',
            'data.print_products' => 'Danger Zone',
            'system.backup' => 'System',
        ];

        foreach ($permissionDefinitions as $slug => $module) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => Str::headline(str_replace('.', ' ', $slug)), 'module' => $module],
            );
        }

        $all = array_keys($permissionDefinitions);

        // Admin gets broad operational access — never role-administration APIs (Super Admin middleware).
        $adminPermissions = array_values(array_filter($all, fn (string $slug): bool => ! str_starts_with($slug, 'roles.') && ! str_starts_with($slug, 'data.')));

        $managerPermissions = [
            'dashboard.view',
            'pos.access', 'pos.create_sale', 'pos.discount', 'pos.cancel_item', 'pos.hold_order',
            'orders.view', 'orders.create', 'orders.update', 'orders.cancel', 'orders.assign_rider',
            'kitchen.view', 'kitchen.accept', 'kitchen.ready', 'kitchen.complete',
            'tables.view', 'tables.manage', 'tables.reservations',
            'menu.view', 'menu.create', 'menu.edit', 'menu.delete',
            'customers.view', 'customers.create', 'customers.edit', 'customers.loyalty',
            'inventory.view', 'inventory.create', 'inventory.edit',
            'purchases.view', 'purchases.create',
            'suppliers.view',
            'riders.view', 'riders.manage',
            'staff.view',
            'attendance.view',
            'reports.view', 'reports.sales', 'reports.overview', 'reports.kitchen', 'reports.customers', 'reports.delivery',
            'promotions.view', 'discounts.view',
            'notifications.view', 'notifications.manage',
            'settings.view',
        ];

        $roleMap = [
            'super_admin' => [
                'name' => 'Super Admin',
                'description' => 'Unrestricted system access. Manages roles and permissions.',
                'discount' => 100,
                'permissions' => $all,
            ],
            'admin' => [
                'name' => 'Admin',
                'description' => 'Broad operational access without role & permission administration.',
                'discount' => 100,
                'permissions' => $adminPermissions,
            ],
            'manager' => [
                'name' => 'Manager',
                'description' => 'Restaurant operations: POS, orders, floor, customers, and key reports.',
                'discount' => 100,
                'permissions' => $managerPermissions,
            ],
            'cashier' => [
                'name' => 'Cashier',
                'description' => 'POS sales, basic orders and customer creation.',
                'discount' => 100,
                'permissions' => [
                    'dashboard.view', 'pos.access', 'pos.create_sale', 'pos.discount', 'pos.cancel_item',
                    'pos.hold_order', 'orders.view', 'orders.create', 'customers.view', 'customers.create',
                    'tables.view', 'notifications.view',
                ],
            ],
            'waiter' => [
                'name' => 'Waiter',
                'description' => 'Tables, orders and menu for floor service.',
                'discount' => 0,
                'permissions' => [
                    'dashboard.view', 'orders.view', 'orders.create', 'orders.update', 'tables.view',
                    'tables.reservations', 'menu.view', 'notifications.view',
                ],
            ],
            'chef' => [
                'name' => 'Chef',
                'description' => 'Kitchen display and recipe visibility.',
                'discount' => 0,
                'permissions' => [
                    'kitchen.view', 'kitchen.accept', 'kitchen.ready', 'kitchen.complete',
                    'orders.view', 'recipes.view', 'menu.view', 'notifications.view',
                ],
            ],
            'kitchen_staff' => [
                'name' => 'Kitchen Staff',
                'description' => 'Kitchen ticket workflow only.',
                'discount' => 0,
                'permissions' => [
                    'kitchen.view', 'kitchen.accept', 'kitchen.ready', 'kitchen.complete',
                    'orders.view', 'notifications.view',
                ],
            ],
            'inventory_manager' => [
                'name' => 'Inventory Manager',
                'description' => 'Stock, purchases, suppliers and inventory reports.',
                'discount' => 0,
                'permissions' => [
                    'dashboard.view', 'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust',
                    'inventory.purchase', 'inventory.wastage', 'purchases.view', 'purchases.create', 'purchases.edit',
                    'suppliers.view', 'suppliers.manage', 'recipes.view', 'recipes.manage', 'reports.inventory',
                    'reports.purchases', 'notifications.view',
                ],
            ],
            'accountant' => [
                'name' => 'Accountant',
                'description' => 'Finance, expenses and financial reports.',
                'discount' => 0,
                'permissions' => [
                    'dashboard.view', 'finance.view', 'finance.expense', 'finance.income', 'finance.payment',
                    'finance.accounts', 'finance.cash_register', 'expenses.view', 'expenses.manage',
                    'reports.view', 'reports.sales', 'reports.finance', 'notifications.view',
                ],
            ],
            'rider' => [
                'name' => 'Rider',
                'description' => 'Assigned deliveries and order status updates.',
                'discount' => 0,
                'permissions' => ['orders.view', 'orders.update', 'riders.view', 'notifications.view'],
            ],
        ];

        foreach ($roleMap as $slug => $definition) {
            $role = Role::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'] ?? null,
                    'max_discount_percent' => $definition['discount'],
                    'is_system' => true,
                    'is_active' => true,
                ],
            );
            $role->permissions()->sync(
                Permission::query()->whereIn('slug', $definition['permissions'])->pluck('id')
            );
        }

        // Keep legacy "kitchen" slug mapped if present
        $legacyKitchen = Role::query()->where('slug', 'kitchen')->first();
        if ($legacyKitchen) {
            $legacyKitchen->permissions()->sync(
                Permission::query()->whereIn('slug', $roleMap['kitchen_staff']['permissions'])->pluck('id')
            );
        }
    }
}
