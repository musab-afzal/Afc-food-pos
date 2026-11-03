import { RefreshCw, SearchX } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';
import AddonCard from './AddonCard.jsx';
import DealCard from './DealCard.jsx';
import ProductCard from './ProductCard.jsx';

export default function ProductGrid() {
    const {
        state, filteredDishes, filteredDeals, filteredAddons, chooseDish, chooseDeal, addAddonToLastItem, loadCatalog,
    } = usePos();
    const showingAddons = state.categoryId === 'addons';
    const hasRows = showingAddons
        ? filteredAddons.length > 0
        : (filteredDishes.length || filteredDeals.length);

    let emptyTitle = 'No dishes found';
    let emptyHint = 'Try another search or category.';
    if (state.categoryId === 'deals') {
        emptyTitle = 'No deals available';
        emptyHint = 'Create or activate deals under Menu → Deals.';
    } else if (state.categoryId === 'addons') {
        emptyTitle = 'No add-ons available';
        emptyHint = 'Create add-ons under Menu → Add-ons.';
    }

    return (
        <section className="afc-pos-products pos-scroll" aria-label={showingAddons ? 'Add-ons' : 'Products'} aria-busy={state.loading}>
            {state.loading && !state.catalog && (
                <div className="afc-pos-product-grid">
                    {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-white/80" />)}
                </div>
            )}
            {state.loadError && (
                <div className="afc-pos-empty">
                    <p>{state.loadError}</p>
                    <button type="button" className="afc-pos-button" onClick={loadCatalog}><RefreshCw size={16} /> Retry</button>
                </div>
            )}
            {!state.loadError && state.catalog && hasRows && (
                <div className="afc-pos-product-grid">
                    {showingAddons && filteredAddons.map((addon) => (
                        <AddonCard
                            key={`addon-${addon.id}`}
                            addon={addon}
                            onSelect={addAddonToLastItem}
                            disabled={state.paying || state.holding}
                            hint={!state.cart.length ? 'Add a dish first, then tap an add-on' : 'Adds to the last item in the cart'}
                        />
                    ))}
                    {!showingAddons && filteredDeals.map((deal) => (
                        <DealCard key={`deal-${deal.id}`} deal={deal} onSelect={chooseDeal} />
                    ))}
                    {!showingAddons && filteredDishes.map((dish) => (
                        <ProductCard key={dish.id} dish={dish} onSelect={chooseDish} />
                    ))}
                </div>
            )}
            {!state.loadError && state.catalog && !hasRows && (
                <div className="afc-pos-empty">
                    <SearchX size={38} />
                    <strong>{emptyTitle}</strong>
                    <p>{emptyHint}</p>
                </div>
            )}
        </section>
    );
}
