import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
    return (
        <div className={`flex items-center gap-2 rounded-[5px] border border-border bg-white px-3 ${className}`}>
            <Search size={16} className="text-muted" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent py-2.5 text-sm text-heading outline-none placeholder:text-muted"
            />
        </div>
    );
}
