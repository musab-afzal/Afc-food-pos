import { RefreshCw, SearchX } from 'lucide-react';
import { usePos } from '../context/PosContext.jsx';
import DealCard from './DealCard.jsx';
import ProductCard from './ProductCard.jsx';

export default function ProductGrid() {
    const { state, filteredDishes, filteredDeals, chooseDish, chooseDeal, loadCatalog } = usePos();
    return (
        <section className="afc-pos-products pos-scroll" aria-label="Products" aria-busy={state.loading}>
            {state.loading && !state.catalog && <div className="afc-pos-product-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-white/80" />)}</div>}
            {state.loadError && <div className="afc-pos-empty"><p>{state.loadError}</p><button type="button" className="afc-pos-button" onClick={loadCatalog}><RefreshCw size={16} /> Retry</button></div>}
            {!state.loadError && state.catalog && (filteredDishes.length || filteredDeals.length ? (
                <div className="afc-pos-product-grid">
                    {filteredDeals.map((deal) => <DealCard key={`deal-${deal.id}`} deal={deal} onSelect={chooseDeal} />)}
                    {filteredDishes.map((dish) => <ProductCard key={dish.id} dish={dish} onSelect={chooseDish} />)}
                </div>
            ) : <div className="afc-pos-empty"><SearchX size={38} /><strong>{state.categoryId === 'deals' ? 'No deals available' : 'No dishes found'}</strong><p>{state.categoryId === 'deals' ? 'Create or activate deals under Menu → Deals.' : 'Try another search or category.'}</p></div>)}
        </section>
    );
}
