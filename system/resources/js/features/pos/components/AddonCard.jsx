import { Plus, Sparkles } from 'lucide-react';
import { money, toCents } from '../utils/cart.js';

export default function AddonCard({ addon, onSelect, disabled = false, hint = '' }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(addon)}
            className="afc-pos-product"
            title={hint || undefined}
            aria-label={`Add ${addon.name}, ${money(toCents(addon.price))}`}
        >
            <div className="afc-pos-product-image">
                <Sparkles size={38} strokeWidth={1.2} className="afc-pos-image-placeholder" aria-hidden="true" />
                <span className="afc-pos-product-badge">Add-on</span>
            </div>
            <div className="afc-pos-product-info">
                <h3>{addon.name}</h3>
                <p className="afc-pos-product-description">{hint || 'Tap to add to the current cart item'}</p>
                <div className="afc-pos-product-price">
                    <strong>{money(toCents(addon.price))}</strong>
                    <span aria-hidden="true"><Plus size={23} /></span>
                </div>
            </div>
        </button>
    );
}
