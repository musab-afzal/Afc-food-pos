import { BadgePercent, Plus } from 'lucide-react';
import { money, toCents } from '../utils/cart.js';

export default function DealCard({ deal, onSelect }) {
    const image = deal.components?.find((c) => c.image)?.image;
    const savingCents = toCents(deal.regular_price) - toCents(deal.price);
    const contents = (deal.components || [])
        .map((c) => `${c.quantity} × ${c.dish_name}${c.variant_name ? ` (${c.variant_name})` : ''}`)
        .join(', ');
    return (
        <button type="button" onClick={() => onSelect(deal)} className="afc-pos-product afc-pos-deal" aria-label={`Add deal ${deal.name}, ${money(toCents(deal.price))}`}>
            <div className="afc-pos-product-image">
                <BadgePercent size={38} strokeWidth={1.2} className="afc-pos-image-placeholder" aria-hidden="true" />
                {image && <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                <span className="afc-pos-product-badge afc-pos-deal-badge"><BadgePercent size={12} /> Deal</span>
                {savingCents > 0 && <span className="afc-pos-deal-saving">Save {money(savingCents)}</span>}
            </div>
            <div className="afc-pos-product-info">
                <h3>{deal.name}</h3>
                <p className="afc-pos-product-description" title={contents}>{contents}</p>
                <div className="afc-pos-product-price">
                    <div className="afc-pos-deal-prices">
                        <strong>{money(toCents(deal.price))}</strong>
                        {savingCents > 0 && <s>{money(toCents(deal.regular_price))}</s>}
                    </div>
                    <span aria-hidden="true"><Plus size={23} /></span>
                </div>
            </div>
        </button>
    );
}
