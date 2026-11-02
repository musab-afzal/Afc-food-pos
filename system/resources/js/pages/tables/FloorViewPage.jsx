import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const statusStyles = {
    available: 'border-herb/30 bg-herb/10 hover:border-herb',
    occupied: 'border-coral/40 bg-coral/10 hover:border-coral',
    reserved: 'border-sky-300 bg-sky-50 hover:border-sky-400',
    cleaning: 'border-amber-300 bg-amber-50 hover:border-amber-400',
    disabled: 'border-ink/10 bg-ink/5 opacity-60',
};

export default function FloorViewPage() {
    const { can } = useAuth();
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api('/tables/floor');
            setAreas(response.data || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function setStatus(table, status) {
        try {
            await api(`/tables/${table.id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
            toast.success(`${table.name} → ${status}`);
            setSelected(null);
            load();
        } catch (error) {
            toast.error(error.message);
        }
    }

    return (
        <div>
            <PageHeader
                title="Floor View"
                description="Live table status across restaurant areas."
                breadcrumbs={['Tables', 'Floor']}
                actions={(
                    <div className="flex gap-2">
                        <button type="button" onClick={load} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <RefreshCw size={16} /> Refresh
                        </button>
                        <Link to="/tables" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Manage tables</Link>
                    </div>
                )}
            />

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : !areas.length ? (
                <div className="rounded-3xl bg-white p-12 text-center text-sm text-ink/45 soft-shadow">No active tables. Create areas and tables first.</div>
            ) : (
                <div className="space-y-8">
                    {areas.map((area) => (
                        <section key={area.id || area.name}>
                            <div className="mb-4 flex items-end justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold">{area.name}</h2>
                                    <p className="text-sm text-ink/45">{(area.tables || []).length} tables</p>
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                {(area.tables || []).map((table) => (
                                    <button
                                        key={table.id}
                                        type="button"
                                        onClick={() => setSelected(table)}
                                        className={`rounded-3xl border-2 p-5 text-left transition soft-shadow ${statusStyles[table.status] || statusStyles.available}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-lg font-semibold">{table.name}</p>
                                            <StatusBadge status={table.status} />
                                        </div>
                                        <p className="mt-4 text-sm text-ink/50">{table.capacity} seats · {table.shape}</p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {selected && (
                <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 soft-shadow" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">Table</p>
                        <h3 className="mt-1 text-2xl font-semibold">{selected.name}</h3>
                        <p className="mt-2 text-sm text-ink/50">{selected.capacity} seats · {selected.shape}</p>
                        <div className="mt-4"><StatusBadge status={selected.status} /></div>
                        {can('tables.manage') && (
                            <div className="mt-6 grid grid-cols-2 gap-2">
                                {['available', 'occupied', 'reserved', 'cleaning'].map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setStatus(selected, status)}
                                        className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm font-medium capitalize hover:bg-ink/5"
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 flex gap-2">
                            {selected.status === 'available' && (
                                <Link to="/pos" className="flex-1 rounded-xl bg-ink py-2.5 text-center text-sm font-semibold text-white">Start order</Link>
                            )}
                            <button type="button" onClick={() => setSelected(null)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink/60">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
