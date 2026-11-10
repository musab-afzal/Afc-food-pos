<?php

use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\AreaController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BackupController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\BulkDataController;
use App\Http\Controllers\Api\V1\CashRegisterController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ChargeController;
use App\Http\Controllers\Api\V1\CouponController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerGroupController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DealController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\DiscountController;
use App\Http\Controllers\Api\V1\DishController;
use App\Http\Controllers\Api\V1\DishVariantController;
use App\Http\Controllers\Api\V1\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\FinanceDashboardController;
use App\Http\Controllers\Api\V1\FinancialTransactionController;
use App\Http\Controllers\Api\V1\HeldOrderController;
use App\Http\Controllers\Api\V1\IncomeController;
use App\Http\Controllers\Api\V1\InventoryCategoryController;
use App\Http\Controllers\Api\V1\InventoryDashboardController;
use App\Http\Controllers\Api\V1\InventoryItemController;
use App\Http\Controllers\Api\V1\InventoryMovementController;
use App\Http\Controllers\Api\V1\KitchenController;
use App\Http\Controllers\Api\V1\LeaveController;
use App\Http\Controllers\Api\V1\LoyaltyController;
use App\Http\Controllers\Api\V1\ModifierGroupController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PaymentMethodController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\PosController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PromotionsDashboardController;
use App\Http\Controllers\Api\V1\PublicQrController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\QrOrderController;
use App\Http\Controllers\Api\V1\RecipeController;
use App\Http\Controllers\Api\V1\RefundController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ReservationController;
use App\Http\Controllers\Api\V1\RiderController;
use App\Http\Controllers\Api\V1\RiderSettlementController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\ShiftController;
use App\Http\Controllers\Api\V1\StaffController;
use App\Http\Controllers\Api\V1\StaffMealController;
use App\Http\Controllers\Api\V1\StaffOpsController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockMovementController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\TaxController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserAccessController;
use App\Http\Controllers\Api\V1\WastageController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // Public QR menu / guest ordering (token-based, no auth)
    Route::prefix('public/qr')->middleware('throttle:60,1')->group(function (): void {
        Route::get('orders/{uuid}', [PublicQrController::class, 'orderStatus']);
        Route::get('{token}', [PublicQrController::class, 'show']);
        Route::get('{token}/menu', [PublicQrController::class, 'menu']);
        Route::post('{token}/orders', [PublicQrController::class, 'storeOrder'])
            ->middleware('throttle:10,1');
    });

    Route::middleware(['auth:sanctum', 'account_active'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('password', [AuthController::class, 'changePassword']);

        Route::get('profile', [ProfileController::class, 'show']);
        Route::put('profile', [ProfileController::class, 'update']);

        Route::get('dashboard', DashboardController::class)->middleware('permission:dashboard.view');

        Route::get('pos/catalog', [PosController::class, 'catalog'])->middleware('permission:pos.access');
        Route::post('pos/sales', [PosController::class, 'store'])->middleware('permission:pos.create_sale');
        Route::post('pos/sync', [PosController::class, 'sync'])->middleware('permission:pos.access');

        Route::middleware('permission:pos.hold_order')->group(function (): void {
            Route::get('pos/holds', [HeldOrderController::class, 'index']);
            Route::post('pos/holds', [HeldOrderController::class, 'store']);
            Route::get('pos/holds/{heldOrder}', [HeldOrderController::class, 'show']);
            Route::put('pos/holds/{heldOrder}', [HeldOrderController::class, 'update']);
            Route::delete('pos/holds/{heldOrder}', [HeldOrderController::class, 'destroy']);
        });

        // Orders
        Route::get('orders', [OrderController::class, 'index'])->middleware('permission:orders.view');
        Route::get('orders/{order}', [OrderController::class, 'show'])->middleware('permission:orders.view');
        Route::post('orders', [OrderController::class, 'store'])->middleware('permission:orders.create');
        Route::patch('orders/{order}/status', [OrderController::class, 'updateStatus'])->middleware('permission:orders.update');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->middleware('permission:orders.cancel');

        // QR guest orders (staff accept / reject)
        Route::get('qr-orders', [QrOrderController::class, 'index'])->middleware('permission:orders.view');
        Route::post('qr-orders/{order}/accept', [QrOrderController::class, 'accept'])
            ->middleware('permission:orders.update');
        // Reject: orders.cancel OR orders.update (checked in controller)
        Route::post('qr-orders/{order}/reject', [QrOrderController::class, 'reject']);

        // Kitchen display — uses existing kitchen.* permissions (not orders.*)
        // kitchen.view reads | kitchen.accept accept/preparing | kitchen.ready ready/item bump | kitchen.complete complete
        Route::middleware('permission:kitchen.view')->group(function (): void {
            Route::get('kitchen/tickets', [KitchenController::class, 'index']);
            Route::get('kitchen/tickets/history', [KitchenController::class, 'history']);
            Route::get('kitchen/tickets/{kitchenTicket}', [KitchenController::class, 'show']);
            Route::get('kitchen/settings', [KitchenController::class, 'settings']);
        });
        Route::post('kitchen/tickets/{kitchenTicket}/accept', [KitchenController::class, 'accept'])
            ->middleware('permission:kitchen.accept');
        Route::post('kitchen/tickets/{kitchenTicket}/preparing', [KitchenController::class, 'preparing'])
            ->middleware('permission:kitchen.accept');
        Route::post('kitchen/tickets/{kitchenTicket}/ready', [KitchenController::class, 'ready'])
            ->middleware('permission:kitchen.ready');
        Route::post('kitchen/tickets/{kitchenTicket}/complete', [KitchenController::class, 'complete'])
            ->middleware('permission:kitchen.complete');
        Route::patch('kitchen/ticket-items/{kitchenTicketItem}/status', [KitchenController::class, 'updateItemStatus'])
            ->middleware('permission:kitchen.ready');

        // Sales / receipts
        Route::get('sales', [SaleController::class, 'index'])->middleware('permission:orders.view');
        Route::get('sales/{sale}', [SaleController::class, 'show'])->middleware('permission:orders.view');
        Route::get('sales/{sale}/receipt', [SaleController::class, 'receipt'])->middleware('permission:orders.view');

        // Refunds (pos.refund to create; pos.refund or orders.update to read)
        Route::get('refunds', [RefundController::class, 'index'])->middleware('permission:pos.refund,orders.update');
        Route::get('refunds/{refund}', [RefundController::class, 'show'])->whereNumber('refund')->middleware('permission:pos.refund,orders.update');
        Route::get('sales/{sale}/refunds', [RefundController::class, 'forSale'])->whereNumber('sale')->middleware('permission:pos.refund,orders.update');
        Route::get('sales/{sale}/refundable', [RefundController::class, 'summary'])->whereNumber('sale')->middleware('permission:pos.refund,orders.update');
        Route::post('refunds', [RefundController::class, 'store'])->middleware('permission:pos.refund');
        Route::post('sales/{sale}/refunds', [RefundController::class, 'store'])->whereNumber('sale')->middleware('permission:pos.refund');

        // Notifications (current user)
        Route::middleware('permission:notifications.view')->group(function (): void {
            Route::get('notifications', [NotificationController::class, 'index']);
            Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
            Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->whereNumber('id');
        });
        // Purchases / suppliers
        Route::middleware('permission:suppliers.view')->group(function (): void {
            Route::get('suppliers', [SupplierController::class, 'index']);
            Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
        });
        Route::middleware('permission:suppliers.manage')->group(function (): void {
            Route::post('suppliers', [SupplierController::class, 'store']);
            Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);
        });
        Route::middleware('permission:purchases.view')->group(function (): void {
            Route::get('purchases', [PurchaseController::class, 'index']);
            Route::get('purchases/{purchase}', [PurchaseController::class, 'show']);
        });
        Route::post('purchases', [PurchaseController::class, 'store'])->middleware('permission:purchases.create');
        Route::put('purchases/{purchase}', [PurchaseController::class, 'update'])->middleware('permission:purchases.edit');
        Route::post('purchases/{purchase}/submit', [PurchaseController::class, 'submit'])->middleware('permission:purchases.edit');
        Route::post('purchases/{purchase}/cancel', [PurchaseController::class, 'cancel'])->middleware('permission:purchases.edit');
        Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive'])->middleware('permission:purchases.approve');

        Route::get('settings', [SettingController::class, 'index']);
        Route::put('settings', [SettingController::class, 'update'])->middleware('permission:settings.manage');

        // Taxes & charges (settings.view/manage to read, settings.manage to write)
        Route::middleware('permission:settings.view,settings.manage')->group(function (): void {
            Route::get('taxes', [TaxController::class, 'index']);
            Route::get('charges', [ChargeController::class, 'index']);
        });
        Route::middleware('permission:settings.manage')->group(function (): void {
            Route::post('taxes', [TaxController::class, 'store']);
            Route::put('taxes/{tax}', [TaxController::class, 'update'])->whereNumber('tax');
            Route::delete('taxes/{tax}', [TaxController::class, 'destroy'])->whereNumber('tax');
            Route::post('charges', [ChargeController::class, 'store']);
            Route::put('charges/{charge}', [ChargeController::class, 'update'])->whereNumber('charge');
            Route::delete('charges/{charge}', [ChargeController::class, 'destroy'])->whereNumber('charge');
        });

        // Slim role list for staff forms (not role administration)
        Route::get('role-options', [RoleController::class, 'options'])->middleware('permission:staff.view,staff.create,staff.edit');

        // Roles & Permissions administration — Super Admin only
        Route::middleware('super_admin_only')->prefix('admin')->group(function (): void {
            Route::get('roles', [RoleController::class, 'index']);
            Route::post('roles', [RoleController::class, 'store']);
            Route::get('roles/{role}', [RoleController::class, 'show'])->whereNumber('role');
            Route::put('roles/{role}', [RoleController::class, 'update'])->whereNumber('role');
            Route::delete('roles/{role}', [RoleController::class, 'destroy'])->whereNumber('role');
            Route::post('roles/{role}/clone', [RoleController::class, 'clone'])->whereNumber('role');
            Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions'])->whereNumber('role');
            Route::put('roles/{role}/status', [RoleController::class, 'setActive'])->whereNumber('role');
            Route::get('roles/{role}/users', [RoleController::class, 'users'])->whereNumber('role');
            Route::get('roles/{role}/activity', [RoleController::class, 'activity'])->whereNumber('role');

            Route::get('permissions', [PermissionController::class, 'index']);
            Route::get('permissions/{permission}', [PermissionController::class, 'show'])->whereNumber('permission');

            Route::get('user-access', [UserAccessController::class, 'index']);
            Route::put('users/{user}', [UserAccessController::class, 'update'])->whereNumber('user');
            Route::delete('users/{user}', [UserAccessController::class, 'destroy'])->whereNumber('user');
            Route::put('users/{user}/role', [UserAccessController::class, 'assignRole'])->whereNumber('user');
            Route::put('users/{user}/status', [UserAccessController::class, 'setStatus'])->whereNumber('user');
            Route::get('users/{user}/effective-permissions', [UserAccessController::class, 'effectivePermissions'])->whereNumber('user');

            // Danger Zone: bulk delete + print lists (Super Admin only).
            Route::prefix('bulk')->group(function (): void {
                Route::post('delete-orders', [BulkDataController::class, 'deleteOrders'])->middleware('permission:data.delete_orders');
                Route::post('delete-customers', [BulkDataController::class, 'deleteCustomers'])->middleware('permission:data.delete_customers');
                Route::post('delete-products', [BulkDataController::class, 'deleteProducts'])->middleware('permission:data.delete_products');
                Route::post('delete-kitchen-orders', [BulkDataController::class, 'deleteKitchenOrders'])->middleware('permission:data.delete_kitchen_orders');
                Route::post('delete-ingredients', [BulkDataController::class, 'deleteIngredients'])->middleware('permission:data.delete_ingredients');
                Route::post('delete-expenses', [BulkDataController::class, 'deleteExpenses'])->middleware('permission:data.delete_expenses');
                Route::post('delete-accounts', [BulkDataController::class, 'deleteAccounts'])->middleware('permission:data.delete_accounts');

                Route::get('print-orders', [BulkDataController::class, 'printOrders'])->middleware('permission:data.print_orders');
                Route::get('print-customers', [BulkDataController::class, 'printCustomers'])->middleware('permission:data.print_customers');
                Route::get('print-products', [BulkDataController::class, 'printProducts'])->middleware('permission:data.print_products');
            });

            Route::prefix('backups')->middleware('permission:system.backup')->group(function (): void {
                Route::get('/', [BackupController::class, 'index']);
                Route::post('/', [BackupController::class, 'store']);
                Route::get('{backup}/download', [BackupController::class, 'download'])->where('backup', '.*');
                Route::delete('{backup}', [BackupController::class, 'destroy'])->where('backup', '.*');
            });
        });

        Route::middleware('permission:staff.view')->group(function (): void {
            Route::get('staff', [StaffController::class, 'index']);
            Route::get('staff/payroll', [StaffMealController::class, 'payroll']);
            Route::get('staff/{staff}', [StaffController::class, 'show']);
        });
        Route::post('staff', [StaffController::class, 'store'])->middleware('permission:staff.create');
        Route::put('staff/{staff}', [StaffController::class, 'update'])->middleware('permission:staff.edit');
        Route::delete('staff/{staff}', [StaffController::class, 'destroy'])->middleware('permission:staff.delete');
        Route::post('staff-meals', [StaffMealController::class, 'store'])->middleware('permission:staff.edit');
        Route::delete('staff-meals/{staffMeal}', [StaffMealController::class, 'destroy'])->middleware('permission:staff.edit')->whereNumber('staffMeal');

        // Staff operations: shifts, attendance, leaves
        Route::middleware('permission:staff.view')->group(function (): void {
            Route::get('shifts', [ShiftController::class, 'index']);
            Route::get('shifts/{shift}', [ShiftController::class, 'show'])->whereNumber('shift');
            Route::get('shifts/{shift}/staff', [ShiftController::class, 'staff'])->whereNumber('shift');
            Route::get('staff/{staff}/shifts', [ShiftController::class, 'forStaff'])->whereNumber('staff');
        });
        Route::middleware('permission:staff.edit')->group(function (): void {
            Route::post('shifts', [ShiftController::class, 'store']);
            Route::put('shifts/{shift}', [ShiftController::class, 'update'])->whereNumber('shift');
            Route::delete('shifts/{shift}', [ShiftController::class, 'destroy'])->whereNumber('shift');
            Route::post('shifts/{shift}/assign', [ShiftController::class, 'assign'])->whereNumber('shift');
            Route::delete('shifts/{shift}/staff/{staff}', [ShiftController::class, 'unassign'])->whereNumber(['shift', 'staff']);
        });

        Route::middleware('permission:attendance.view')->group(function (): void {
            Route::get('attendance', [AttendanceController::class, 'index']);
            Route::get('attendance/{attendance}', [AttendanceController::class, 'show'])->whereNumber('attendance');
            Route::get('leaves', [LeaveController::class, 'index']);
            Route::get('leaves/{leave}', [LeaveController::class, 'show'])->whereNumber('leave');
            Route::get('staff-ops/dashboard', [StaffOpsController::class, 'dashboard']);
        });
        Route::middleware('permission:attendance.manage')->group(function (): void {
            Route::post('attendance/check-in', [AttendanceController::class, 'checkIn']);
            Route::post('attendance/check-out', [AttendanceController::class, 'checkOut']);
            Route::post('attendance', [AttendanceController::class, 'store']);
            Route::put('attendance/{attendance}', [AttendanceController::class, 'update'])->whereNumber('attendance');
        });
        Route::post('leaves', [LeaveController::class, 'store'])->middleware('permission:attendance.manage,staff.edit');
        Route::middleware('permission:attendance.approve')->group(function (): void {
            Route::post('leaves/{leave}/approve', [LeaveController::class, 'approve'])->whereNumber('leave');
            Route::post('leaves/{leave}/reject', [LeaveController::class, 'reject'])->whereNumber('leave');
        });

        Route::get('activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:activity_logs.view');
        Route::get('activity-logs/{activityLog}', [ActivityLogController::class, 'show'])->middleware('permission:activity_logs.view');

        Route::middleware('permission:menu.view')->group(function (): void {
            Route::get('categories', [CategoryController::class, 'index']);
            Route::get('categories/{category}', [CategoryController::class, 'show']);
            Route::get('dishes', [DishController::class, 'index']);
            Route::get('dishes/{dish}', [DishController::class, 'show']);
            Route::get('dishes/{dish}/variants', [DishVariantController::class, 'index']);
            Route::get('brands', [BrandController::class, 'index']);
            Route::get('brands/{brand}', [BrandController::class, 'show']);
            Route::get('addons', [AddonController::class, 'index']);
            Route::get('addons/{addon}', [AddonController::class, 'show']);
            Route::get('modifier-groups', [ModifierGroupController::class, 'index']);
            Route::get('modifier-groups/{modifierGroup}', [ModifierGroupController::class, 'show']);
            Route::get('deals', [DealController::class, 'index']);
            Route::get('deals/products', [DealController::class, 'products']);
            Route::get('deals/{deal}', [DealController::class, 'show']);
        });
        Route::post('dishes/upload-image', [DishController::class, 'uploadImage'])
            ->middleware('permission:menu.create,menu.edit');
        Route::middleware('permission:menu.create')->group(function (): void {
            Route::post('categories', [CategoryController::class, 'store']);
            Route::post('dishes', [DishController::class, 'store']);
            Route::post('dishes/{dish}/variants', [DishVariantController::class, 'store']);
            Route::post('brands', [BrandController::class, 'store']);
            Route::post('addons', [AddonController::class, 'store']);
            Route::post('modifier-groups', [ModifierGroupController::class, 'store']);
            Route::post('deals', [DealController::class, 'store']);
        });
        Route::middleware('permission:menu.edit')->group(function (): void {
            Route::put('categories/{category}', [CategoryController::class, 'update']);
            Route::put('dishes/{dish}', [DishController::class, 'update']);
            Route::put('dishes/{dish}/variants/{variant}', [DishVariantController::class, 'update']);
            Route::put('brands/{brand}', [BrandController::class, 'update']);
            Route::put('addons/{addon}', [AddonController::class, 'update']);
            Route::put('modifier-groups/{modifierGroup}', [ModifierGroupController::class, 'update']);
            Route::put('deals/{deal}', [DealController::class, 'update']);
            Route::patch('deals/{deal}/toggle', [DealController::class, 'toggle']);
        });
        Route::middleware('permission:menu.delete')->group(function (): void {
            Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
            Route::delete('dishes/{dish}', [DishController::class, 'destroy']);
            Route::delete('dishes/{dish}/variants/{variant}', [DishVariantController::class, 'destroy']);
            Route::delete('brands/{brand}', [BrandController::class, 'destroy']);
            Route::delete('addons/{addon}', [AddonController::class, 'destroy']);
            Route::delete('modifier-groups/{modifierGroup}', [ModifierGroupController::class, 'destroy']);
            Route::delete('deals/{deal}', [DealController::class, 'destroy']);
        });

        // Inventory — view
        Route::middleware('permission:inventory.view')->group(function (): void {
            Route::get('inventory/dashboard', InventoryDashboardController::class);
            Route::get('inventory/items', [InventoryItemController::class, 'index']);
            Route::get('inventory/items/{inventoryItem}', [InventoryItemController::class, 'show']);
            Route::get('inventory/categories', [InventoryCategoryController::class, 'index']);
            Route::get('inventory/categories/{inventoryCategory}', [InventoryCategoryController::class, 'show']);
            Route::get('units', [UnitController::class, 'index']);
            Route::get('units/{unit}', [UnitController::class, 'show']);
            Route::get('inventory/movements', [InventoryMovementController::class, 'index']);
            Route::get('inventory/adjustments', [StockAdjustmentController::class, 'index']);
            Route::get('inventory/adjustments/{stockAdjustment}', [StockAdjustmentController::class, 'show']);
            Route::get('inventory/wastages', [WastageController::class, 'index']);
            Route::get('inventory/wastages/{wastage}', [WastageController::class, 'show']);
        });

        // Inventory — create
        Route::middleware('permission:inventory.create')->group(function (): void {
            Route::post('inventory/items', [InventoryItemController::class, 'store']);
            Route::post('inventory/categories', [InventoryCategoryController::class, 'store']);
            Route::post('units', [UnitController::class, 'store']);
        });

        // Inventory — edit / soft-delete
        Route::middleware('permission:inventory.edit')->group(function (): void {
            Route::put('inventory/items/{inventoryItem}', [InventoryItemController::class, 'update']);
            Route::delete('inventory/items/{inventoryItem}', [InventoryItemController::class, 'destroy']);
            Route::put('inventory/categories/{inventoryCategory}', [InventoryCategoryController::class, 'update']);
            Route::delete('inventory/categories/{inventoryCategory}', [InventoryCategoryController::class, 'destroy']);
            Route::put('units/{unit}', [UnitController::class, 'update']);
            Route::delete('units/{unit}', [UnitController::class, 'destroy']);
        });

        // Inventory — adjust
        Route::middleware('permission:inventory.adjust')->group(function (): void {
            Route::post('inventory/stock-in', [StockMovementController::class, 'stockIn']);
            Route::post('inventory/stock-out', [StockMovementController::class, 'stockOut']);
            Route::post('inventory/adjustments', [StockAdjustmentController::class, 'store']);
        });

        // Inventory — wastage
        Route::post('inventory/wastages', [WastageController::class, 'store'])->middleware('permission:inventory.wastage');

        // Recipes
        Route::middleware('permission:recipes.view')->group(function (): void {
            Route::get('recipes/costing', [RecipeController::class, 'costing']);
            Route::get('recipes', [RecipeController::class, 'index']);
            Route::get('recipes/{recipe}', [RecipeController::class, 'show']);
        });
        Route::middleware('permission:recipes.manage')->group(function (): void {
            Route::post('recipes', [RecipeController::class, 'store']);
            Route::put('recipes/{recipe}', [RecipeController::class, 'update']);
            Route::delete('recipes/{recipe}', [RecipeController::class, 'destroy']);
        });

        // Tables / floor / areas
        Route::middleware('permission:tables.view')->group(function (): void {
            Route::get('areas', [AreaController::class, 'index']);
            Route::get('areas/{area}', [AreaController::class, 'show']);
            Route::get('tables/floor', [TableController::class, 'floor']);
            Route::get('tables', [TableController::class, 'index']);
            Route::get('tables/{table}', [TableController::class, 'show']);
            Route::get('tables/{table}/qr', [TableController::class, 'qr']);
            Route::get('reservations', [ReservationController::class, 'index']);
            Route::get('reservations/{reservation}', [ReservationController::class, 'show']);
        });
        Route::middleware('permission:tables.manage')->group(function (): void {
            Route::post('areas', [AreaController::class, 'store']);
            Route::put('areas/{area}', [AreaController::class, 'update']);
            Route::delete('areas/{area}', [AreaController::class, 'destroy']);
            Route::post('tables', [TableController::class, 'store']);
            Route::put('tables/{table}', [TableController::class, 'update']);
            Route::delete('tables/{table}', [TableController::class, 'destroy']);
            Route::post('tables/{table}/status', [TableController::class, 'updateStatus']);
            Route::post('tables/{table}/move', [TableController::class, 'move']);
        });
        Route::middleware('permission:tables.reservations')->group(function (): void {
            Route::post('reservations', [ReservationController::class, 'store']);
            Route::put('reservations/{reservation}', [ReservationController::class, 'update']);
            Route::delete('reservations/{reservation}', [ReservationController::class, 'destroy']);
            Route::patch('reservations/{reservation}/status', [ReservationController::class, 'updateStatus']);
        });

        // Customers / groups
        Route::middleware('permission:customers.view')->group(function (): void {
            Route::get('customers', [CustomerController::class, 'index']);
            Route::get('customers/{customer}', [CustomerController::class, 'show']);
            Route::get('customers/{customer}/ledger', [CustomerController::class, 'ledger']);
            Route::get('customer-groups', [CustomerGroupController::class, 'index']);
            Route::get('customer-groups/{customerGroup}', [CustomerGroupController::class, 'show']);
        });
        Route::post('customers', [CustomerController::class, 'store'])->middleware('permission:customers.create');
        Route::put('customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:customers.edit');
        Route::delete('customers/{customer}', [CustomerController::class, 'destroy'])->middleware('permission:customers.delete');
        Route::middleware('permission:customers.edit')->group(function (): void {
            Route::post('customer-groups', [CustomerGroupController::class, 'store']);
            Route::put('customer-groups/{customerGroup}', [CustomerGroupController::class, 'update']);
            Route::delete('customer-groups/{customerGroup}', [CustomerGroupController::class, 'destroy']);
        });

        // Finance
        Route::middleware('permission:finance.view')->group(function (): void {
            Route::get('finance/dashboard', FinanceDashboardController::class);
            Route::get('financial-transactions', [FinancialTransactionController::class, 'index']);
            Route::get('accounts', [AccountController::class, 'index']);
            Route::get('accounts/{account}', [AccountController::class, 'show']);
            Route::get('payment-methods', [PaymentMethodController::class, 'index']);
            Route::get('incomes', [IncomeController::class, 'index']);
            Route::get('incomes/{income}', [IncomeController::class, 'show']);
            Route::get('cash-registers', [CashRegisterController::class, 'index']);
        });
        Route::middleware('permission:expenses.view')->group(function (): void {
            Route::get('expense-categories', [ExpenseCategoryController::class, 'index']);
            Route::get('expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'show']);
            Route::get('expenses', [ExpenseController::class, 'index']);
            Route::get('expenses/{expense}', [ExpenseController::class, 'show']);
        });
        Route::middleware('permission:expenses.manage')->group(function (): void {
            Route::post('expense-categories', [ExpenseCategoryController::class, 'store']);
            Route::put('expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'update']);
            Route::delete('expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'destroy']);
        });
        Route::middleware('permission:finance.expense')->group(function (): void {
            Route::post('expenses', [ExpenseController::class, 'store']);
            Route::put('expenses/{expense}', [ExpenseController::class, 'update']);
            Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy']);
        });
        Route::middleware('permission:finance.income')->group(function (): void {
            Route::post('incomes', [IncomeController::class, 'store']);
            Route::put('incomes/{income}', [IncomeController::class, 'update']);
            Route::delete('incomes/{income}', [IncomeController::class, 'destroy']);
        });
        Route::middleware('permission:finance.accounts')->group(function (): void {
            Route::post('accounts', [AccountController::class, 'store']);
            Route::put('accounts/{account}', [AccountController::class, 'update']);
            Route::post('accounts/{account}/adjustments', [AccountController::class, 'adjust']);
        });
        Route::middleware('permission:finance.payment')->group(function (): void {
            Route::post('payment-methods', [PaymentMethodController::class, 'store']);
            Route::put('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);
        });
        Route::middleware('permission:finance.cash_register')->group(function (): void {
            Route::get('cash-registers/current', [CashRegisterController::class, 'current']);
            Route::get('cash-registers/{cashRegister}', [CashRegisterController::class, 'show'])->whereNumber('cashRegister');
            Route::post('cash-registers', [CashRegisterController::class, 'store']);
            Route::post('cash-registers/{cashRegister}/transactions', [CashRegisterController::class, 'transaction'])->whereNumber('cashRegister');
            Route::post('cash-registers/{cashRegister}/close', [CashRegisterController::class, 'close'])->whereNumber('cashRegister');
        });
        // Promotions: discounts, coupons, loyalty
        Route::middleware('permission:promotions.view,promotions.manage,discounts.view,discounts.manage,coupons.manage')->group(function (): void {
            Route::get('promotions/dashboard', PromotionsDashboardController::class);
            Route::get('discounts', [DiscountController::class, 'index']);
            Route::get('discounts/{discount}', [DiscountController::class, 'show'])->whereNumber('discount');
            Route::get('coupons', [CouponController::class, 'index']);
            Route::get('coupons/{coupon}', [CouponController::class, 'show'])->whereNumber('coupon');
        });
        Route::middleware('permission:discounts.manage,promotions.manage')->group(function (): void {
            Route::post('discounts', [DiscountController::class, 'store']);
            Route::put('discounts/{discount}', [DiscountController::class, 'update'])->whereNumber('discount');
            Route::delete('discounts/{discount}', [DiscountController::class, 'destroy'])->whereNumber('discount');
        });
        Route::middleware('permission:coupons.manage,promotions.manage')->group(function (): void {
            Route::post('coupons', [CouponController::class, 'store']);
            Route::put('coupons/{coupon}', [CouponController::class, 'update'])->whereNumber('coupon');
            Route::delete('coupons/{coupon}', [CouponController::class, 'destroy'])->whereNumber('coupon');
        });
        // Coupon check is usable at the POS (pos.access) as well as from promotion management.
        Route::post('coupons/validate', [CouponController::class, 'validateCode'])
            ->middleware('permission:pos.access,promotions.view,promotions.manage,coupons.manage');
        Route::get('loyalty/transactions', [LoyaltyController::class, 'transactions'])
            ->middleware('permission:promotions.view,loyalty.manage,customers.view,customers.loyalty');
        Route::post('loyalty/adjust', [LoyaltyController::class, 'adjust'])
            ->middleware('permission:loyalty.manage,customers.loyalty');

        // Reports (read-only, from/to query params; default month-to-date)
        Route::prefix('reports')->group(function (): void {
            Route::get('overview', [ReportController::class, 'overview'])->middleware('permission:reports.overview,reports.view');
            Route::get('sales', [ReportController::class, 'sales'])->middleware('permission:reports.sales,finance.view');
            Route::get('dishes', [ReportController::class, 'dishes'])->middleware('permission:reports.sales');
            Route::get('inventory', [ReportController::class, 'inventory'])->middleware('permission:reports.inventory');
            Route::get('purchases', [ReportController::class, 'purchases'])->middleware('permission:reports.purchases');
            Route::get('finance', [ReportController::class, 'finance'])->middleware('permission:reports.finance');
            Route::get('staff', [ReportController::class, 'staff'])->middleware('permission:reports.staff');
            Route::get('waiters', [ReportController::class, 'waiters'])->middleware('permission:reports.staff,reports.sales');
            Route::get('delivery', [ReportController::class, 'delivery'])->middleware('permission:reports.delivery');
            Route::get('kitchen', [ReportController::class, 'kitchen'])->middleware('permission:reports.kitchen');
            Route::get('customers', [ReportController::class, 'customers'])->middleware('permission:reports.customers');
            Route::get('{type}/export', [ReportController::class, 'export'])->middleware('permission:reports.export');
        });

        // Riders / deliveries
        Route::middleware('permission:riders.view')->group(function (): void {
            Route::get('riders', [RiderController::class, 'index']);
            Route::get('riders/{rider}', [RiderController::class, 'show']);
            Route::get('deliveries', [DeliveryController::class, 'index']);
            Route::get('deliveries/active', [DeliveryController::class, 'active']);
            Route::get('deliveries/{delivery}', [DeliveryController::class, 'show']);
        });
        Route::middleware('permission:riders.manage')->group(function (): void {
            Route::post('riders', [RiderController::class, 'store']);
            Route::put('riders/{rider}', [RiderController::class, 'update']);
            Route::delete('riders/{rider}', [RiderController::class, 'destroy']);
        });
        // Rider COD settlements (riders.view to read, riders.settle to write)
        Route::middleware('permission:riders.view')->group(function (): void {
            Route::get('rider-settlements', [RiderSettlementController::class, 'index']);
            Route::get('rider-settlements/preview', [RiderSettlementController::class, 'preview']);
            Route::get('rider-settlements/{riderSettlement}', [RiderSettlementController::class, 'show'])->whereNumber('riderSettlement');
        });
        Route::middleware('permission:riders.settle')->group(function (): void {
            Route::post('rider-settlements', [RiderSettlementController::class, 'store']);
            Route::post('rider-settlements/{riderSettlement}/settle', [RiderSettlementController::class, 'settle'])->whereNumber('riderSettlement');
            Route::post('rider-settlements/{riderSettlement}/cancel', [RiderSettlementController::class, 'cancel'])->whereNumber('riderSettlement');
        });
        Route::post('deliveries/assign', [DeliveryController::class, 'assign'])
            ->middleware('permission:orders.assign_rider');
        Route::patch('deliveries/{delivery}/status', [DeliveryController::class, 'updateStatus'])
            ->middleware('permission:orders.update');
    });
});
