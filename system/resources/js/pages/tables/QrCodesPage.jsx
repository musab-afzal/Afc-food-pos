import { Copy, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../services/api.js';

export default function QrCodesPage() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const response = await api('/tables?per_page=100&is_active=1');
            const list = response.data || [];
            const withQr = await Promise.all(list.map(async (table) => {
                try {
                    const qr = await api(`/tables/${table.id}/qr`);
                    return { ...table, qr: qr.data };
                } catch {
                    return { ...table, qr: null };
                }
            }));
            setTables(withQr);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function copy(text) {
        navigator.clipboard.writeText(text).then(() => toast.success('Copied')).catch(() => toast.error('Copy failed'));
    }

    return (
        <div>
            <PageHeader
                title="QR Codes"
                description="Unique tokens for table-side QR ordering."
                breadcrumbs={['Tables', 'QR Codes']}
                actions={(
                    <button type="button" onClick={load} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                        <RefreshCw size={16} /> Refresh
                    </button>
                )}
            />
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {tables.map((table) => {
                        const url = table.qr?.url || table.qr?.path || '';
                        return (
                            <article key={table.id} className="rounded-3xl bg-white p-5 soft-shadow">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{table.name}</p>
                                        <p className="text-xs text-ink/40">{table.area?.name || 'No area'}</p>
                                    </div>
                                    <StatusBadge status={table.status} />
                                </div>
                                <p className="mt-4 break-all rounded-xl bg-cream px-3 py-2 text-xs text-ink/60">{url || 'No token'}</p>
                                <button
                                    type="button"
                                    disabled={!url}
                                    onClick={() => copy(url)}
                                    className="mt-4 flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                    <Copy size={14} /> Copy link
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
