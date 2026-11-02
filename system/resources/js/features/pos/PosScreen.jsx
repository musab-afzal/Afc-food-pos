import { useEffect } from 'react';
import CartPanel from './components/CartPanel.jsx';
import DiscountModal from './components/DiscountModal.jsx';
import HoldOrdersDrawer from './components/HoldOrdersDrawer.jsx';
import PaymentModal from './components/PaymentModal.jsx';
import PosHeader from './components/PosHeader.jsx';
import PosNotice from './components/PosNotice.jsx';
import ProductGrid from './components/ProductGrid.jsx';
import ProductModal from './components/ProductModal.jsx';
import QuickCustomerModal from './components/QuickCustomerModal.jsx';
import RecentOrdersDrawer from './components/RecentOrdersDrawer.jsx';
import SuccessModal from './components/SuccessModal.jsx';
import TablePicker from './components/TablePicker.jsx';
import PosNavigation from './components/PosNavigation.jsx';
import PosStats from './components/PosStats.jsx';
import OrderToolbar from './components/OrderToolbar.jsx';
import { PosProvider, usePos } from './context/PosContext.jsx';
import '../../../css/pos.css';

function PosShortcuts() {
    const { state, patch, searchRef, openPayment, holdOrder, can } = usePos();

    useEffect(() => {
        function onKey(event) {
            const tag = event.target?.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (event.key === 'Escape') {
                if (state.paying) return;
                patch({
                    paymentOpen: false,
                    discountOpen: false,
                    holdsOpen: false,
                    recentOpen: false,
                    tablePickerOpen: false,
                    customerModalOpen: false,
                    customizing: null,
                    editingKey: null,
                    clearConfirm: false,
                    success: null,
                    notice: '',
                });
                return;
            }

            if (event.key === 'F2' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
                event.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select?.();
                return;
            }

            if (event.key === 'F4' && !typing) {
                event.preventDefault();
                openPayment();
                return;
            }

            if (event.key === 'F6' && !typing && can('pos.hold_order')) {
                event.preventDefault();
                holdOrder();
                return;
            }

            if (event.key === 'Delete' && event.ctrlKey && !typing && state.cart.length) {
                event.preventDefault();
                patch({ clearConfirm: true });
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [patch, searchRef, openPayment, holdOrder, can, state.cart.length, state.paying]);

    return null;
}

function PosLayout() {
    return (
        <div className="afc-pos">
            <PosNavigation />
            <div className="afc-pos-main">
                <PosHeader />
                <div className="afc-pos-body">
                    <section className="afc-pos-menu" aria-label="Menu and order details">
                        <PosStats />
                        <OrderToolbar />
                        <ProductGrid />
                    </section>
                    <CartPanel />
                </div>
            </div>
            <PosNotice />
            <ProductModal />
            <PaymentModal />
            <DiscountModal />
            <TablePicker />
            <QuickCustomerModal />
            <HoldOrdersDrawer />
            <RecentOrdersDrawer />
            <SuccessModal />
            <PosShortcuts />
        </div>
    );
}

export default function PosScreen() {
    return (
        <PosProvider>
            <PosLayout />
        </PosProvider>
    );
}
