import { ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { usePos } from '../context/PosContext.jsx';

export default function CategorySidebar() {
    const { state, patch } = usePos();
    const scroller = useRef(null);
    const categories = [{ id: 'all', name: 'All Items' }, ...(state.catalog?.categories || [])];
    return (
        <nav className="afc-pos-categories" aria-label="Menu categories">
            <div ref={scroller} className="afc-pos-category-list scrollbar-none">
                {categories.map((category) => <button key={category.id} type="button" aria-pressed={state.categoryId === category.id} onClick={() => patch({ categoryId: category.id })} className={state.categoryId === category.id ? 'is-active' : ''}>{category.name}</button>)}
            </div>
            <button type="button" className="afc-pos-category-next" aria-label="Show more categories" onClick={() => scroller.current?.scrollBy({ left: 260, behavior: 'smooth' })}><ChevronRight size={21} /></button>
        </nav>
    );
}
