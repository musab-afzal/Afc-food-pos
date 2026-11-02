import { AlertTriangle, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { escapeHtml, printHtml } from '../../utils/print.js';

const dangerActions = [
    { key: 'orders', label: 'Delete all orders', permission: 'data.delete_orders', path: '/admin/bulk/delete-orders', hint: 'Orders, sales, payments, refunds, kitchen tickets and deliveries.' },
    { key: 'customers', label: 'Delete all customers', permission: 'data.delete_customers', path: '/admin/bulk/delete-customers', hint: 'Customer records (history on past sales is kept).' },
    { key: 'products', label: 'Delete all products', permission: 'data.delete_products', path: '/admin/bulk/delete-products', hint: 'Dishes with their variations, recipes and deals.' },
    { key: 'kitchen', label: 'Delete all kitchen orders', permission: 'data.delete_kitchen_orders', path: '/admin/bulk/delete-kitchen-orders', hint: 'Every kitchen ticket, active and historical.' },
    { key: 'ingredients', label: 'Delete all ingredients', permission: 'data.delete_ingredients', path: '/admin/bulk/delete-ingredients', hint: 'Inventory items and the recipe lines that use them.' },
    { key: 'expenses', label: 'Delete all expenses', permission: 'data.delete_expenses', path: '/admin/bulk/delete-expenses', hint: 'Expenses, their ledger entries and expense categories.' },
    { key: 'accounts', label: 'Delete all accounts', permission: 'data.delete_accounts', path: '/admin/bulk/delete-accounts', hint: 'Finance accounts; ledger entries are detached.' },
];

const printActions = [
    { key: 'orders', label: 'Print orders', permission: 'data.print_orders', path: '/admin/bulk/print-orders', dates: true },
    { key: 'customers', label: 'Print customers', permission: 'data.print_customers', path: '/admin/bulk/print-customers' },
    { key: 'products', label: 'Print products', permission: 'data.print_products', path: '/admin/bulk/print-products' },
];

const headingFor = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function cell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

function buildTableHtml(title, generatedAt, rows) {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const head = columns.map((key) => `<th>${escapeHtml(headingFor(key))}</th>`).join('');
    const body = rows.length
        ? rows.map((row) => `<tr>${columns.map((key) => `<td>${escapeHtml(cell(row[key]))}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${Math.max(columns.length, 1)}">No records found.</td></tr>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>${rows.length} record(s) &middot; generated ${escapeHtml(new Date(generatedAt || Date.now()).toLocaleString())}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

export default function BulkDataPage() {
    const { can, isSuperAdmin } = useAuth();
    const [pending, setPending] = useState(null);
    const [password, setPassword] = useState('');
    const [busyKey, setBusyKey] = useState('');
    const [dates, setDates] = useState({ date_from: '', date_to: '' });

    const visibleDanger = dangerActions.filter((action) => isSuperAdmin && can(action.permission));
    const visiblePrint = printActions.filter((action) => isSuperAdmin && can(action.permission));

    function openConfirm(action) {
        setPassword('');
        setPending(action);
    }

    async function runDelete() {
        if (!pending || !password.trim()) return;
        setBusyKey(`delete-${pending.key}`);
        try {
            const response = await api(pending.path, {
                method: 'POST',
                body: JSON.stringify({ password }),
            });
            toast.success(response.message || 'Deleted');
            setPending(null);
            setPassword('');
        } catch (error) {
            toast.error(error.message || 'Incorrect password or delete failed.');
        } finally {
            setBusyKey('');
        }
    }

    async function runPrint(action) {
        setBusyKey(`print-${action.key}`);
        try {
            const params = new URLSearchParams();
            if (action.dates) {
                if (dates.date_from) params.set('date_from', dates.date_from);
                if (dates.date_to) params.set('date_to', dates.date_to);
            }
            const query = params.toString();
            const response = await api(`${action.path}${query ? `?${query}` : ''}`);
            const payload = response.data || {};
            const rows = Array.isArray(payload.rows) ? payload.rows : Array.isArray(payload) ? payload : [];
            printHtml(buildTableHtml(payload.title || action.label, payload.generated_at, rows), { title: payload.title || action.label });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusyKey('');
        }
    }

    return (
        <div className="mx-auto max-w-4xl">
            <PageHeader
                eyebrow="System administration"
                title="Bulk data"
                description="Super Admin tools for wiping data and printing full lists."
                breadcrumbs={['Administration', 'Bulk data']}
            />

            <section className="mb-6 rounded-lg border border-coral/30 bg-white p-6 soft-shadow">
                <div className="mb-4 flex items-center gap-2 text-coral">
                    <AlertTriangle size={20} />
                    <h2 className="text-lg font-bold">Danger zone</h2>
                </div>
                <p className="mb-5 text-sm text-muted">These actions remove data for the whole restaurant and cannot be undone. You will be asked to confirm each one.</p>
                {visibleDanger.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {visibleDanger.map((action) => (
                            <div key={action.key} className="flex flex-col justify-between gap-3 rounded-[8px] border border-border p-4">
                                <div>
                                    <p className="font-semibold text-heading">{action.label}</p>
                                    <p className="mt-1 text-xs text-muted">{action.hint}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openConfirm(action)}
                                    disabled={Boolean(busyKey)}
                                    className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-coral px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    <Trash2 size={16} /> {action.label}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted">No bulk delete actions are available for your account.</p>
                )}
            </section>

            <section className="rounded-lg border border-border bg-white p-6 soft-shadow">
                <div className="mb-4 flex items-center gap-2 text-heading">
                    <Printer size={20} />
                    <h2 className="text-lg font-bold">Print lists</h2>
                </div>
                {visiblePrint.length ? (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted">
                            <span>Order date range (optional):</span>
                            <label className="flex items-center gap-2">From
                                <input type="date" className="field" value={dates.date_from} max={dates.date_to || undefined} onChange={(e) => setDates((d) => ({ ...d, date_from: e.target.value }))} />
                            </label>
                            <label className="flex items-center gap-2">To
                                <input type="date" className="field" value={dates.date_to} min={dates.date_from || undefined} onChange={(e) => setDates((d) => ({ ...d, date_to: e.target.value }))} />
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {visiblePrint.map((action) => (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={() => runPrint(action)}
                                    disabled={Boolean(busyKey)}
                                    className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Printer size={16} /> {busyKey === `print-${action.key}` ? 'Preparing…' : action.label}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted">No print actions are available for your account.</p>
                )}
            </section>

            {pending && (
                <div className="fixed inset-0 z-[60] grid place-items-center bg-secondary/50 p-4">
                    <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 soft-shadow" role="dialog" aria-modal="true" aria-labelledby="bulk-delete-title">
                        <h2 id="bulk-delete-title" className="text-xl font-bold text-heading">{pending.label}?</h2>
                        <p className="mt-2 text-sm leading-6 text-muted">{pending.hint} This cannot be undone.</p>
                        <label className="mt-4 block text-sm font-medium">
                            Enter your login password to confirm
                            <input
                                className="field mt-2"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && password.trim()) runDelete(); }}
                                autoFocus
                            />
                        </label>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => { setPending(null); setPassword(''); }} className="btn-secondary py-3">Cancel</button>
                            <button
                                type="button"
                                disabled={!password.trim() || busyKey === `delete-${pending.key}`}
                                onClick={runDelete}
                                className="rounded-[5px] bg-coral py-3 text-sm font-bold text-white disabled:opacity-50"
                            >
                                {busyKey === `delete-${pending.key}` ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
