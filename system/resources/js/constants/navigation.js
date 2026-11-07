import {
    Activity, BadgePercent, BarChart3, Bike, Boxes, ChefHat, Database, LayoutDashboard, Package, Receipt,
    Settings2, Shield, Store, Truck, Users, UtensilsCrossed, Wallet,
} from 'lucide-react';

/**
 * Only include routes that have real working pages.
 */
export const navigation = [
    {
        label: 'Overview',
        items: [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
            { to: '/pos', label: 'POS', icon: Store, permission: 'pos.access' },
        ],
    },
    {
        label: 'Operations',
        items: [
            {
                label: 'Orders',
                icon: Receipt,
                permission: 'orders.view',
                children: [
                    { to: '/orders', label: 'All Orders' },
                    { to: '/orders/qr', label: 'QR Orders' },
                    { to: '/sales', label: 'Sales & Receipts' },
                ],
            },
            {
                label: 'Kitchen',
                icon: ChefHat,
                permission: 'kitchen.view',
                children: [
                    { to: '/kitchen', label: 'Kitchen Display' },
                    { to: '/kitchen/history', label: 'Kitchen History' },
                ],
            },
            {
                label: 'Delivery',
                icon: Bike,
                permission: 'riders.view',
                children: [
                    { to: '/deliveries', label: 'Deliveries' },
                    { to: '/riders', label: 'Riders' },
                    { to: '/rider-settlements', label: 'Settlements', permission: 'riders.view' },
                ],
            },
            {
                label: 'Tables',
                icon: UtensilsCrossed,
                permission: 'tables.view',
                children: [
                    { to: '/tables/floor', label: 'Floor View' },
                    { to: '/tables', label: 'Tables' },
                    { to: '/tables/areas', label: 'Areas' },
                    { to: '/tables/reservations', label: 'Reservations', permission: 'tables.reservations' },
                    { to: '/tables/qr-codes', label: 'QR Codes' },
                ],
            },
        ],
    },
    {
        label: 'Catalog',
        items: [
            {
                label: 'Menu',
                icon: Package,
                permission: 'menu.view',
                children: [
                    { to: '/menu/dishes', label: 'Dishes' },
                    { to: '/menu/categories', label: 'Categories' },
                    { to: '/menu/brands', label: 'Brands' },
                    { to: '/menu/addons', label: 'Add-ons' },
                    { to: '/menu/deals', label: 'Deals' },
                    { to: '/menu/modifier-groups', label: 'Modifier Groups' },
                    { to: '/menu/variations', label: 'Variations' },
                ],
            },
            {
                label: 'Recipes',
                icon: UtensilsCrossed,
                permission: 'recipes.view',
                children: [
                    { to: '/recipes', label: 'Recipe Mapping' },
                    { to: '/recipes/costing', label: 'Recipe Costing' },
                ],
            },
        ],
    },
    {
        label: 'Supply',
        items: [
            {
                label: 'Inventory',
                icon: Boxes,
                permission: 'inventory.view',
                children: [
                    { to: '/inventory', label: 'Dashboard' },
                    { to: '/inventory/ingredients', label: 'Ingredients' },
                    { to: '/inventory/categories', label: 'Categories' },
                    { to: '/inventory/stock', label: 'Stock' },
                    { to: '/inventory/stock-in', label: 'Stock In' },
                    { to: '/inventory/stock-out', label: 'Stock Out' },
                    { to: '/inventory/adjustments', label: 'Adjustments' },
                    { to: '/inventory/wastage', label: 'Wastage' },
                    { to: '/inventory/movements', label: 'Movements' },
                    { to: '/inventory/units', label: 'Units' },
                ],
            },
            {
                label: 'Purchases',
                icon: Truck,
                permission: 'purchases.view',
                children: [
                    { to: '/purchases', label: 'Purchase Orders' },
                    { to: '/suppliers', label: 'Suppliers', permission: 'suppliers.view' },
                ],
            },
        ],
    },
    {
        label: 'Finance',
        items: [
            {
                label: 'Finance',
                icon: Wallet,
                permission: 'finance.view',
                children: [
                    { to: '/finance', label: 'Dashboard' },
                    { to: '/finance/sales', label: 'Sales', permission: 'finance.view' },
                    { to: '/finance/expenses', label: 'Expenses', permission: 'expenses.view' },
                    { to: '/finance/expense-categories', label: 'Expense categories', permission: 'expenses.manage' },
                    { to: '/finance/incomes', label: 'Income' },
                    { to: '/finance/cash-register', label: 'Cash register', permission: 'finance.cash_register' },
                    { to: '/finance/accounts', label: 'Accounts' },
                    { to: '/finance/ledger', label: 'Ledger' },
                    { to: '/finance/payment-methods', label: 'Payment methods' },
                ],
            },
            {
                label: 'Promotions',
                icon: BadgePercent,
                permission: 'promotions.view',
                children: [
                    { to: '/promotions', label: 'Dashboard' },
                    { to: '/promotions/discounts', label: 'Discounts', permission: 'discounts.view' },
                    { to: '/promotions/coupons', label: 'Coupons' },
                    { to: '/promotions/loyalty', label: 'Loyalty', permission: 'customers.loyalty' },
                ],
            },
        ],
    },
    {
        label: 'People',
        items: [
            {
                label: 'Customers',
                icon: Users,
                permission: 'customers.view',
                children: [
                    { to: '/customers', label: 'Customer List' },
                    { to: '/customers/groups', label: 'Groups' },
                    { to: '/customers/loyalty', label: 'Loyalty' },
                    { to: '/customers/ledger', label: 'Ledger' },
                ],
            },
            {
                label: 'Staff',
                icon: Users,
                permission: 'staff.view',
                children: [
                    { to: '/staff', label: 'Employees' },
                    { to: '/staff/shifts', label: 'Shifts' },
                    { to: '/staff/attendance', label: 'Attendance', permission: 'attendance.view' },
                    { to: '/staff/leaves', label: 'Leaves', permission: 'attendance.view' },
                ],
            },
        ],
    },
    {
        label: 'Insights',
        items: [
            {
                label: 'Reports',
                icon: BarChart3,
                permission: 'reports.view',
                children: [
                    { to: '/reports', label: 'Overview' },
                    { to: '/reports/sales', label: 'Sales', permission: 'reports.sales' },
                    { to: '/reports/products', label: 'Products', permission: 'reports.sales' },
                    { to: '/reports/inventory', label: 'Inventory', permission: 'reports.inventory' },
                    { to: '/reports/purchases', label: 'Purchases', permission: 'reports.purchases' },
                    { to: '/reports/finance', label: 'Finance', permission: 'reports.finance' },
                    { to: '/reports/staff', label: 'Staff', permission: 'reports.staff' },
                    { to: '/reports/delivery', label: 'Delivery', permission: 'reports.delivery' },
                    { to: '/reports/kitchen', label: 'Kitchen', permission: 'reports.kitchen' },
                    { to: '/reports/customers', label: 'Customers', permission: 'reports.customers' },
                    { to: '/reports/waiters', label: 'Waiters', permission: 'reports.staff' },
                ],
            },
        ],
    },
    {
        label: 'System Administration',
        superAdminOnly: true,
        items: [
            {
                label: 'Roles & Permissions',
                icon: Shield,
                superAdminOnly: true,
                children: [
                    { to: '/roles', label: 'Roles', superAdminOnly: true },
                    { to: '/permissions', label: 'Permissions', superAdminOnly: true },
                    { to: '/user-access', label: 'User Access', superAdminOnly: true },
                ],
            },
            { to: '/admin/bulk-data', label: 'Bulk Data', icon: Database, superAdminOnly: true },
            { to: '/admin/backups', label: 'Backups', icon: Database, superAdminOnly: true, permission: 'system.backup' },
        ],
    },
    {
        label: 'System',
        items: [
            {
                label: 'Settings',
                icon: Settings2,
                permission: 'settings.view',
                children: [
                    { to: '/settings/restaurant', label: 'Restaurant' },
                    { to: '/settings/pos', label: 'POS' },
                    { to: '/settings/order', label: 'Order' },
                    { to: '/settings/kitchen', label: 'Kitchen' },
                    { to: '/settings/delivery', label: 'Delivery' },
                    { to: '/settings/inventory', label: 'Inventory' },
                    { to: '/settings/receipt', label: 'Receipt' },
                    { to: '/settings/loyalty', label: 'Loyalty' },
                    { to: '/settings/currency', label: 'Currency' },
                    { to: '/settings/taxes', label: 'Taxes' },
                    { to: '/settings/charges', label: 'Charges' },
                    { to: '/settings/system', label: 'System' },
                ],
            },
            { to: '/activity-logs', label: 'Activity Logs', icon: Activity, permission: 'activity_logs.view' },
            { to: '/profile', label: 'Profile', icon: Users },
        ],
    },
];

export function filterNavigation(nav, can, isSuperAdmin = false) {
    return nav
        .filter((section) => !section.superAdminOnly || isSuperAdmin)
        .map((section) => ({
            ...section,
            items: section.items
                .filter((item) => !item.hidden)
                .filter((item) => !item.superAdminOnly || isSuperAdmin)
                .filter((item) => !item.permission || can(item.permission))
                .map((item) => {
                    if (!item.children) return item;
                    return {
                        ...item,
                        children: item.children
                            .filter((child) => !child.superAdminOnly || isSuperAdmin)
                            .filter((child) => !child.permission || can(child.permission)),
                    };
                })
                .filter((item) => !item.children || item.children.length > 0),
        }))
        .filter((section) => section.items.length > 0);
}
