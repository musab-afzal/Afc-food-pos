import { Layers3, Plus, Utensils } from 'lucide-react';
import { mediaUrl } from '../../../utils/media.js';
import { money, toCents } from '../utils/cart.js';

export default function ProductCard({ dish, onSelect }) {
    const unavailable = dish.is_available === false;
    const hasOptions = Boolean(dish.variants?.length || dish.addons?.length);
    const image = mediaUrl(dish.image_url || dish.image);
    return (
        <button type="button" disabled={unavailable} onClick={() => onSelect(dish)} className="afc-pos-product" aria-label={`${hasOptions ? 'Customize' : 'Add'} ${dish.name}, ${money(toCents(dish.price))}`}>
            <div className="afc-pos-product-image">
                <Utensils size={38} strokeWidth={1.2} className="afc-pos-image-placeholder" aria-hidden="true" />
                {image && <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                {hasOptions && <span className="afc-pos-product-badge"><Layers3 size={12} /> Options</span>}
                {unavailable && <span className="afc-pos-unavailable">Unavailable</span>}
            </div>
            <div className="afc-pos-product-info">
                <h3>{dish.name}</h3>
                <p className="afc-pos-product-description">{dish.description || (hasOptions ? 'Choose your preferred options' : 'Freshly prepared to order')}</p>
                <div className="afc-pos-product-price"><strong>{money(toCents(dish.price))}</strong><span aria-hidden="true"><Plus size={23} /></span></div>
            </div>
        </button>
    );
}
