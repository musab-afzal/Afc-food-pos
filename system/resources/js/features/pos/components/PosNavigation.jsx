import { ArrowLeft, BadgePercent, ChefHat, ClipboardList, LayoutGrid, Sparkles, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePos } from '../context/PosContext.jsx';

export default function PosNavigation() {
    const { can, state, patch, loadHolds, categoryCounts, catalogAddons } = usePos();
    const categories = [
        { id: 'all', name: 'All Items' },
        ...(state.catalog?.deals?.length ? [{ id: 'deals', name: 'Deals' }] : []),
        ...(catalogAddons?.length ? [{ id: 'addons', name: 'Add-ons' }] : []),
        ...(state.catalog?.categories || []),
    ];
    return (
        <aside className="afc-pos-sidebar">
            <Link to="/" className="afc-pos-brand" aria-label="AFC dashboard">
                <ChefHat size={45} strokeWidth={1.8} />
                <span><strong>AFC</strong><small>AALESHAN FOOD COURT</small></span>
            </Link>
            <p className="afc-pos-category-heading">Product Categories</p>
            <nav aria-label="Product categories" className="afc-pos-sidebar-categories">
                {categories.map((category) => (
                    <button type="button" key={category.id} aria-pressed={state.categoryId === category.id} className={state.categoryId === category.id ? 'is-active' : ''} title={category.name} onClick={() => patch({ categoryId: category.id, query: '' })}>
                        <span className="afc-pos-category-symbol" aria-hidden="true">
                            {category.id === 'all' ? <LayoutGrid size={21} />
                                : category.id === 'deals' ? <BadgePercent size={21} />
                                    : category.id === 'addons' ? <Sparkles size={21} />
                                        : category.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="afc-pos-category-name">{category.name}</span>
                        <b>{categoryCounts[category.id] || 0}</b>
                    </button>
                ))}
            </nav>
            <div className="afc-pos-sidebar-actions">
                <Link to="/" className="afc-pos-back" title="Back to dashboard"><ArrowLeft size={19} /><span>Dashboard</span></Link>
                {can('pos.hold_order') && <button type="button" className="afc-pos-held" onClick={() => { patch({ holdsOpen: true }); loadHolds(); }} title="Resume held orders"><ClipboardList size={19} /><span>Held Orders</span><b>{state.holds.length}</b></button>}
            </div>
            <div className="afc-pos-motto"><Utensils size={34} /><p>Good Food<br />Happier People<span /></p></div>
        </aside>
    );
}
