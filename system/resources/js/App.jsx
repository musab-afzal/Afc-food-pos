import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ActivityLogsPage from './pages/ActivityLogsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DishesPage from './pages/DishesPage.jsx';
import CustomerDetailPage from './pages/customers/CustomerDetailPage.jsx';
import CustomerGroupsPage from './pages/customers/CustomerGroupsPage.jsx';
import CustomerLedgerPage from './pages/customers/CustomerLedgerPage.jsx';
import CustomersPage from './pages/customers/CustomersPage.jsx';
import LoyaltyPage from './pages/customers/LoyaltyPage.jsx';
import AdjustmentsPage from './pages/inventory/AdjustmentsPage.jsx';
import IngredientsPage from './pages/inventory/IngredientsPage.jsx';
import InventoryCategoriesPage from './pages/inventory/InventoryCategoriesPage.jsx';
import InventoryDashboardPage from './pages/inventory/InventoryDashboardPage.jsx';
import MovementsPage from './pages/inventory/MovementsPage.jsx';
import StockMovementPage from './pages/inventory/StockMovementPage.jsx';
import UnitsPage from './pages/inventory/UnitsPage.jsx';
import WastagePage from './pages/inventory/WastagePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AddonsPage from './pages/menu/AddonsPage.jsx';
import DealsPage from './pages/menu/DealsPage.jsx';
import BrandsPage from './pages/menu/BrandsPage.jsx';
import ModifierGroupsPage from './pages/menu/ModifierGroupsPage.jsx';
import VariationsPage from './pages/menu/VariationsPage.jsx';
import PosPage from './pages/PosPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RecipeCostingPage from './pages/recipes/RecipeCostingPage.jsx';
import RecipesPage from './pages/recipes/RecipesPage.jsx';
import SettingsGroupPage from './pages/settings/SettingsGroupPage.jsx';
import AttendancePage from './pages/staff/AttendancePage.jsx';
import LeavesPage from './pages/staff/LeavesPage.jsx';
import SuperAdminRoute from './components/SuperAdminRoute.jsx';
import PermissionsCatalogPage from './features/roles/pages/PermissionsCatalogPage.jsx';
import RoleDetailPage from './features/roles/pages/RoleDetailPage.jsx';
import RoleFormPage from './features/roles/pages/RoleFormPage.jsx';
import RolesPage from './features/roles/pages/RolesPage.jsx';
import UserAccessPage from './features/roles/pages/UserAccessPage.jsx';
import BulkDataPage from './pages/admin/BulkDataPage.jsx';
import ShiftsPage from './pages/staff/ShiftsPage.jsx';
import StaffPage from './pages/staff/StaffPage.jsx';
import DeliveriesPage from './pages/delivery/DeliveriesPage.jsx';
import RidersPage from './pages/delivery/RidersPage.jsx';
import SettlementsPage from './pages/delivery/SettlementsPage.jsx';
import AccountsPage from './pages/finance/AccountsPage.jsx';
import CashRegisterPage from './pages/finance/CashRegisterPage.jsx';
import ExpenseCategoriesPage from './pages/finance/ExpenseCategoriesPage.jsx';
import ExpensesPage from './pages/finance/ExpensesPage.jsx';
import FinanceDashboardPage from './pages/finance/FinanceDashboardPage.jsx';
import IncomesPage from './pages/finance/IncomesPage.jsx';
import LedgerPage from './pages/finance/LedgerPage.jsx';
import PaymentMethodsPage from './pages/finance/PaymentMethodsPage.jsx';
import CouponsPage from './pages/promotions/CouponsPage.jsx';
import DiscountsPage from './pages/promotions/DiscountsPage.jsx';
import LoyaltyManagePage from './pages/promotions/LoyaltyManagePage.jsx';
import PromotionsDashboardPage from './pages/promotions/PromotionsDashboardPage.jsx';
import CustomersReportPage from './pages/reports/CustomersReportPage.jsx';
import DeliveryReportPage from './pages/reports/DeliveryReportPage.jsx';
import FinanceReportPage from './pages/reports/FinanceReportPage.jsx';
import InventoryReportPage from './pages/reports/InventoryReportPage.jsx';
import KitchenReportPage from './pages/reports/KitchenReportPage.jsx';
import ProductsReportPage from './pages/reports/ProductsReportPage.jsx';
import PurchasesReportPage from './pages/reports/PurchasesReportPage.jsx';
import ReportsOverviewPage from './pages/reports/ReportsOverviewPage.jsx';
import SalesReportPage from './pages/reports/SalesReportPage.jsx';
import StaffReportPage from './pages/reports/StaffReportPage.jsx';
import WaitersReportPage from './pages/reports/WaitersReportPage.jsx';
import ChargesPage from './pages/settings/ChargesPage.jsx';
import TaxesPage from './pages/settings/TaxesPage.jsx';
import KitchenDisplayPage from './pages/kitchen/KitchenDisplayPage.jsx';
import KitchenHistoryPage from './pages/kitchen/KitchenHistoryPage.jsx';
import PurchaseDetailPage from './pages/purchases/PurchaseDetailPage.jsx';
import PurchasesPage from './pages/purchases/PurchasesPage.jsx';
import SuppliersPage from './pages/purchases/SuppliersPage.jsx';
import OrderDetailPage from './pages/orders/OrderDetailPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';
import QrOrdersPage from './pages/orders/QrOrdersPage.jsx';
import SaleDetailPage from './pages/orders/SaleDetailPage.jsx';
import SaleReceiptPage from './pages/orders/SaleReceiptPage.jsx';
import SalesPage from './pages/orders/SalesPage.jsx';
import PublicQrMenuPage from './pages/qr/PublicQrMenuPage.jsx';
import AreasPage from './pages/tables/AreasPage.jsx';
import FloorViewPage from './pages/tables/FloorViewPage.jsx';
import QrCodesPage from './pages/tables/QrCodesPage.jsx';
import ReservationsPage from './pages/tables/ReservationsPage.jsx';
import TablesPage from './pages/tables/TablesPage.jsx';

function ProtectedRoute({ children, permission }) {
    const { user, loading, can } = useAuth();
    if (loading) {
        return <div className="grid min-h-screen place-items-center bg-secondary text-white">Loading AFC...</div>;
    }
    if (!user) return <Navigate to="/login" replace />;
    if (permission && !can(permission)) return <Navigate to="/" replace />;
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/menu/table/:token" element={<PublicQrMenuPage />} />
                <Route path="/pos" element={<ProtectedRoute permission="pos.access"><PosPage /></ProtectedRoute>} />
                <Route path="/kitchen" element={<ProtectedRoute permission="kitchen.view"><KitchenDisplayPage /></ProtectedRoute>} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route index element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
                    <Route path="/menu/dishes" element={<ProtectedRoute permission="menu.view"><DishesPage /></ProtectedRoute>} />
                    <Route path="/menu/categories" element={<ProtectedRoute permission="menu.view"><CategoriesPage /></ProtectedRoute>} />
                    <Route path="/menu/brands" element={<ProtectedRoute permission="menu.view"><BrandsPage /></ProtectedRoute>} />
                    <Route path="/menu/addons" element={<ProtectedRoute permission="menu.view"><AddonsPage /></ProtectedRoute>} />
                    <Route path="/menu/deals" element={<ProtectedRoute permission="menu.view"><DealsPage /></ProtectedRoute>} />
                    <Route path="/menu/modifier-groups" element={<ProtectedRoute permission="menu.view"><ModifierGroupsPage /></ProtectedRoute>} />
                    <Route path="/menu/variations" element={<ProtectedRoute permission="menu.view"><VariationsPage /></ProtectedRoute>} />

                    <Route path="/recipes" element={<ProtectedRoute permission="recipes.view"><RecipesPage /></ProtectedRoute>} />
                    <Route path="/recipes/costing" element={<ProtectedRoute permission="recipes.view"><RecipeCostingPage /></ProtectedRoute>} />

                    <Route path="/inventory" element={<ProtectedRoute permission="inventory.view"><InventoryDashboardPage /></ProtectedRoute>} />
                    <Route path="/inventory/ingredients" element={<ProtectedRoute permission="inventory.view"><IngredientsPage /></ProtectedRoute>} />
                    <Route path="/inventory/categories" element={<ProtectedRoute permission="inventory.view"><InventoryCategoriesPage /></ProtectedRoute>} />
                    <Route path="/inventory/stock" element={<ProtectedRoute permission="inventory.view"><IngredientsPage stockOnly defaultFilter="" /></ProtectedRoute>} />
                    <Route path="/inventory/stock-in" element={<ProtectedRoute permission="inventory.adjust"><StockMovementPage type="stock_in" /></ProtectedRoute>} />
                    <Route path="/inventory/stock-out" element={<ProtectedRoute permission="inventory.adjust"><StockMovementPage type="stock_out" /></ProtectedRoute>} />
                    <Route path="/inventory/adjustments" element={<ProtectedRoute permission="inventory.view"><AdjustmentsPage /></ProtectedRoute>} />
                    <Route path="/inventory/wastage" element={<ProtectedRoute permission="inventory.view"><WastagePage /></ProtectedRoute>} />
                    <Route path="/inventory/movements" element={<ProtectedRoute permission="inventory.view"><MovementsPage /></ProtectedRoute>} />
                    <Route path="/inventory/units" element={<ProtectedRoute permission="inventory.view"><UnitsPage /></ProtectedRoute>} />

                    <Route path="/tables/floor" element={<ProtectedRoute permission="tables.view"><FloorViewPage /></ProtectedRoute>} />
                    <Route path="/tables" element={<ProtectedRoute permission="tables.view"><TablesPage /></ProtectedRoute>} />
                    <Route path="/tables/areas" element={<ProtectedRoute permission="tables.view"><AreasPage /></ProtectedRoute>} />
                    <Route path="/tables/reservations" element={<ProtectedRoute permission="tables.reservations"><ReservationsPage /></ProtectedRoute>} />
                    <Route path="/tables/qr-codes" element={<ProtectedRoute permission="tables.view"><QrCodesPage /></ProtectedRoute>} />

                    <Route path="/orders" element={<ProtectedRoute permission="orders.view"><OrdersPage /></ProtectedRoute>} />
                    <Route path="/orders/qr" element={<ProtectedRoute permission="orders.view"><QrOrdersPage /></ProtectedRoute>} />
                    <Route path="/orders/:id" element={<ProtectedRoute permission="orders.view"><OrderDetailPage /></ProtectedRoute>} />
                    <Route path="/sales" element={<ProtectedRoute permission="orders.view"><SalesPage /></ProtectedRoute>} />
                    <Route path="/sales/:id" element={<ProtectedRoute permission="orders.view"><SaleDetailPage /></ProtectedRoute>} />
                    <Route path="/sales/:id/receipt" element={<ProtectedRoute permission="orders.view"><SaleReceiptPage /></ProtectedRoute>} />

                    <Route path="/kitchen/history" element={<ProtectedRoute permission="kitchen.view"><KitchenHistoryPage /></ProtectedRoute>} />

                    <Route path="/purchases" element={<ProtectedRoute permission="purchases.view"><PurchasesPage /></ProtectedRoute>} />
                    <Route path="/purchases/:id" element={<ProtectedRoute permission="purchases.view"><PurchaseDetailPage /></ProtectedRoute>} />
                    <Route path="/suppliers" element={<ProtectedRoute permission="suppliers.view"><SuppliersPage /></ProtectedRoute>} />

                    <Route path="/deliveries" element={<ProtectedRoute permission="riders.view"><DeliveriesPage /></ProtectedRoute>} />
                    <Route path="/riders" element={<ProtectedRoute permission="riders.view"><RidersPage /></ProtectedRoute>} />
                    <Route path="/rider-settlements" element={<ProtectedRoute permission="riders.view"><SettlementsPage /></ProtectedRoute>} />

                    <Route path="/finance" element={<ProtectedRoute permission="finance.view"><FinanceDashboardPage /></ProtectedRoute>} />
                    <Route path="/finance/expenses" element={<ProtectedRoute permission="expenses.view"><ExpensesPage /></ProtectedRoute>} />
                    <Route path="/finance/expense-categories" element={<ProtectedRoute permission="expenses.manage"><ExpenseCategoriesPage /></ProtectedRoute>} />
                    <Route path="/finance/incomes" element={<ProtectedRoute permission="finance.view"><IncomesPage /></ProtectedRoute>} />
                    <Route path="/finance/cash-register" element={<ProtectedRoute permission="finance.cash_register"><CashRegisterPage /></ProtectedRoute>} />
                    <Route path="/finance/accounts" element={<ProtectedRoute permission="finance.view"><AccountsPage /></ProtectedRoute>} />
                    <Route path="/finance/ledger" element={<ProtectedRoute permission="finance.view"><LedgerPage /></ProtectedRoute>} />
                    <Route path="/finance/payment-methods" element={<ProtectedRoute permission="finance.view"><PaymentMethodsPage /></ProtectedRoute>} />

                    <Route path="/promotions" element={<ProtectedRoute permission="promotions.view"><PromotionsDashboardPage /></ProtectedRoute>} />
                    <Route path="/promotions/discounts" element={<ProtectedRoute permission="discounts.view"><DiscountsPage /></ProtectedRoute>} />
                    <Route path="/promotions/coupons" element={<ProtectedRoute permission="promotions.view"><CouponsPage /></ProtectedRoute>} />
                    <Route path="/promotions/loyalty" element={<ProtectedRoute permission="customers.loyalty"><LoyaltyManagePage /></ProtectedRoute>} />

                    <Route path="/reports" element={<ProtectedRoute permission="reports.view"><ReportsOverviewPage /></ProtectedRoute>} />
                    <Route path="/reports/sales" element={<ProtectedRoute permission="reports.sales"><SalesReportPage /></ProtectedRoute>} />
                    <Route path="/reports/products" element={<ProtectedRoute permission="reports.sales"><ProductsReportPage /></ProtectedRoute>} />
                    <Route path="/reports/inventory" element={<ProtectedRoute permission="reports.inventory"><InventoryReportPage /></ProtectedRoute>} />
                    <Route path="/reports/purchases" element={<ProtectedRoute permission="reports.purchases"><PurchasesReportPage /></ProtectedRoute>} />
                    <Route path="/reports/finance" element={<ProtectedRoute permission="reports.finance"><FinanceReportPage /></ProtectedRoute>} />
                    <Route path="/reports/staff" element={<ProtectedRoute permission="reports.staff"><StaffReportPage /></ProtectedRoute>} />
                    <Route path="/reports/delivery" element={<ProtectedRoute permission="reports.delivery"><DeliveryReportPage /></ProtectedRoute>} />
                    <Route path="/reports/kitchen" element={<ProtectedRoute permission="reports.kitchen"><KitchenReportPage /></ProtectedRoute>} />
                    <Route path="/reports/customers" element={<ProtectedRoute permission="reports.customers"><CustomersReportPage /></ProtectedRoute>} />
                    <Route path="/reports/waiters" element={<ProtectedRoute permission="reports.staff"><WaitersReportPage /></ProtectedRoute>} />

                    <Route path="/customers" element={<ProtectedRoute permission="customers.view"><CustomersPage /></ProtectedRoute>} />
                    <Route path="/customers/groups" element={<ProtectedRoute permission="customers.view"><CustomerGroupsPage /></ProtectedRoute>} />
                    <Route path="/customers/loyalty" element={<ProtectedRoute permission="customers.view"><LoyaltyPage /></ProtectedRoute>} />
                    <Route path="/customers/ledger" element={<ProtectedRoute permission="customers.view"><CustomerLedgerPage /></ProtectedRoute>} />
                    <Route path="/customers/:id" element={<ProtectedRoute permission="customers.view"><CustomerDetailPage /></ProtectedRoute>} />

                    <Route path="/staff" element={<ProtectedRoute permission="staff.view"><StaffPage /></ProtectedRoute>} />
                    <Route path="/staff/shifts" element={<ProtectedRoute permission="staff.view"><ShiftsPage /></ProtectedRoute>} />
                    <Route path="/staff/attendance" element={<ProtectedRoute permission="attendance.view"><AttendancePage /></ProtectedRoute>} />
                    <Route path="/staff/leaves" element={<ProtectedRoute permission="attendance.view"><LeavesPage /></ProtectedRoute>} />
                    <Route path="/roles" element={<SuperAdminRoute><RolesPage /></SuperAdminRoute>} />
                    <Route path="/roles/create" element={<SuperAdminRoute><RoleFormPage /></SuperAdminRoute>} />
                    <Route path="/roles/:id" element={<SuperAdminRoute><RoleDetailPage /></SuperAdminRoute>} />
                    <Route path="/roles/:id/edit" element={<SuperAdminRoute><RoleFormPage /></SuperAdminRoute>} />
                    <Route path="/permissions" element={<SuperAdminRoute><PermissionsCatalogPage /></SuperAdminRoute>} />
                    <Route path="/user-access" element={<SuperAdminRoute><UserAccessPage /></SuperAdminRoute>} />
                    <Route path="/admin/bulk-data" element={<SuperAdminRoute><BulkDataPage /></SuperAdminRoute>} />
                    <Route path="/staff/roles" element={<Navigate to="/roles" replace />} />
                    <Route path="/staff/permissions" element={<Navigate to="/permissions" replace />} />
                    <Route path="/settings/taxes" element={<ProtectedRoute permission="settings.view"><TaxesPage /></ProtectedRoute>} />
                    <Route path="/settings/charges" element={<ProtectedRoute permission="settings.view"><ChargesPage /></ProtectedRoute>} />
                    <Route path="/settings/:group" element={<ProtectedRoute permission="settings.view"><SettingsRoute /></ProtectedRoute>} />
                    <Route path="/activity-logs" element={<ProtectedRoute permission="activity_logs.view"><ActivityLogsPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    );
}

function SettingsRoute() {
    const { group } = useParams();
    const allowed = ['restaurant', 'pos', 'order', 'kitchen', 'delivery', 'inventory', 'receipt', 'loyalty', 'currency', 'system'];
    if (!allowed.includes(group)) return <Navigate to="/settings/restaurant" replace />;
    return <SettingsGroupPage group={group} />;
}
