import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, apiUrl } from '../../services/api.js';

function monthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

export default function ReportShell({
    title,
    description,
    breadcrumbs,
    endpoint,
    children,
    extraParams = {},
    exportType,
}) {
    const { can } = useAuth();
    const [from, setFrom] = useState(monthStart);
    const [to, setTo] = useState(today);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const query = useMemo(() => {
        const params = new URLSearchParams({ from, to, ...Object.fromEntries(Object.entries(extraParams).filter(([, v]) => v !== '' && v != null)) });
        return params.toString();
    }, [from, to, JSON.stringify(extraParams)]);

    useEffect(() => {
        setLoading(true);
        api(`${endpoint}?${query}`)
            .then((response) => setData(response.data))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [endpoint, query]);

    async function downloadCsv() {
        if (!exportType) return;
        setExporting(true);
        try {
            const token = localStorage.getItem('respos_token');
            const response = await fetch(`${apiUrl(`/reports/${exportType}/export`)}?${query}&format=csv`, {
                headers: { Accept: 'text/csv', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message || 'Export failed');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${exportType}-${from}-to-${to}.csv`;
            anchor.click();
            URL.revokeObjectURL(url);
            toast.success('CSV downloaded');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setExporting(false);
        }
    }

    return (
        <div>
            <PageHeader
                title={title}
                description={description}
                breadcrumbs={breadcrumbs}
                actions={exportType && can('reports.export') && (
                    <button type="button" disabled={exporting} onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                        <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                )}
            />
            <div className="mb-5 flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium">From
                    <input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="text-sm font-medium">To
                    <input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
            </div>
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : children(data)}
        </div>
    );
}

export function StatGrid({ items }) {
    return (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <article key={item.label} className="rounded-3xl bg-white p-5 soft-shadow">
                    <p className="text-xs uppercase tracking-wider text-ink/40">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                    {item.hint && <p className="mt-1 text-xs text-ink/40">{item.hint}</p>}
                </article>
            ))}
        </section>
    );
}

export function SimpleTable({ title, columns, rows, empty = 'No rows in this period.' }) {
    return (
        <article className="rounded-3xl bg-white p-6 soft-shadow">
            {title && <p className="mb-4 font-semibold">{title}</p>}
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-ink/10 text-ink/45">
                            {columns.map((col) => <th key={col.key} className={`px-2 py-2 font-medium ${col.className || ''}`}>{col.label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/7">
                        {(rows || []).length ? rows.map((row, index) => (
                            <tr key={row.id || row.key || index}>
                                {columns.map((col) => (
                                    <td key={col.key} className={`px-2 py-3 ${col.className || ''}`}>
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        )) : (
                            <tr><td colSpan={columns.length} className="px-2 py-10 text-center text-ink/40">{empty}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </article>
    );
}
