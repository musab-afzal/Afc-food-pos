import { CalendarDays, X } from 'lucide-react';
import SearchInput from './SearchInput.jsx';

const dateClass = 'rounded-[5px] border border-border bg-white px-3 py-2.5 text-sm text-heading outline-none focus:border-primary';

/**
 * Reusable list toolbar: search + date range + any extra filters (children).
 * Date handlers are optional — omit them to hide the date range.
 */
export default function ListFilters({
    search = '',
    onSearch,
    searchPlaceholder = 'Search…',
    dateFrom = '',
    dateTo = '',
    onDateFrom,
    onDateTo,
    children,
    className = '',
}) {
    const showDates = Boolean(onDateFrom || onDateTo);
    const hasDates = Boolean(dateFrom || dateTo);

    return (
        <div className={`mb-4 flex flex-wrap items-center gap-3 ${className}`}>
            {onSearch && (
                <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="min-w-[220px] flex-1" />
            )}
            {showDates && (
                <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays size={16} className="text-muted" />
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                        From
                        <input
                            type="date"
                            className={dateClass}
                            value={dateFrom || ''}
                            max={dateTo || undefined}
                            onChange={(event) => onDateFrom?.(event.target.value)}
                        />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                        To
                        <input
                            type="date"
                            className={dateClass}
                            value={dateTo || ''}
                            min={dateFrom || undefined}
                            onChange={(event) => onDateTo?.(event.target.value)}
                        />
                    </label>
                    {hasDates && (
                        <button
                            type="button"
                            onClick={() => { onDateFrom?.(''); onDateTo?.(''); }}
                            className="inline-flex items-center gap-1 rounded-[5px] px-2 py-2 text-xs font-semibold text-muted hover:text-heading"
                            title="Clear dates"
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            )}
            {children}
        </div>
    );
}
