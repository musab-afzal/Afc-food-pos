import { Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDateTime } from '../../utils/format.js';

export default function CashRegisterPage() {
    const { can } = useAuth();
    const [current, setCurrent] = useState(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [filters, setFilters] = useState({ status: '', page: 1, per_page: 10 });
    const { rows, meta, loading, reload } = usePaginatedResource('/cash-registers', filters);
    const [openForm, setOpenForm] = useState(false);
    const [txnForm, setTxnForm] = useState(null);
    const [closeForm, setCloseForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('0');
    const [notes, setNotes] = useState('');
    const [txnAmount, setTxnAmount] = useState('');
    const [txnNotes, setTxnNotes] = useState('');
    const [actualClosing, setActualClosing] = useState('');

    const loadCurrent = useCallback(() => {
        setLoadingCurrent(true);
        api('/cash-registers/current')
            .then((response) => setCurrent(response.data))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoadingCurrent(false));
    }, []);

    useEffect(() => { loadCurrent(); }, [loadCurrent]);

    async function openRegister(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const response = await api('/cash-registers', {
                method: 'POST',
                body: JSON.stringify({ opening_amount: Number(openingAmount), notes: notes || null }),
            });
            setCurrent(response.data);
            setOpenForm(false);
            setOpeningAmount('0');
            setNotes('');
            toast.success('Cash register opened');
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function postTransaction(event) {
        event.preventDefault();
        if (!current?.id || !txnForm) return;
        setBusy(true);
        try {
            const response = await api(`/cash-registers/${current.id}/transactions`, {
                method: 'POST',
                body: JSON.stringify({ type: txnForm, amount: Number(txnAmount), notes: txnNotes || null }),
            });
            setCurrent(response.data.register);
            setTxnForm(null);
            setTxnAmount('');
            setTxnNotes('');
            toast.success(txnForm === 'cash_in' ? 'Cash in recorded' : 'Cash out recorded');
            loadCurrent();
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function closeRegister(event) {
        event.preventDefault();
        if (!current?.id) return;
        setBusy(true);
        try {
            const response = await api(`/cash-registers/${current.id}/close`, {
                method: 'POST',
                body: JSON.stringify({ actual_closing: Number(actualClosing), notes: notes || null }),
            });
            toast.success(`Closed · difference ${currency(response.data.difference)}`);
            setCloseForm(false);
            setActualClosing('');
            setNotes('');
            setCurrent(null);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Cash register"
                description="Open the drawer, move cash, and close with variance."
                breadcrumbs={['Finance', 'Cash register']}
            />

            <article className="mb-5 card-panel p-6">
                {loadingCurrent ? (
                    <div className="h-28 animate-pulse rounded-2xl bg-ink/[.04]" />
                ) : current ? (
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <StatusBadge status="open" />
                                <p className="text-sm text-ink/45">Opened {formatDateTime(current.opened_at)} by {current.user?.name || 'you'}</p>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink/40">Opening</p>
                                    <p className="mt-1 text-2xl font-semibold">{currency(current.opening_amount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink/40">Expected</p>
                                    <p className="mt-1 text-2xl font-semibold text-herb">{currency(current.expected_closing ?? current.opening_amount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink/40">Movements</p>
                                    <p className="mt-1 text-2xl font-semibold">{(current.transactions || []).length}</p>
                                </div>
                            </div>
                        </div>
                        {can('finance.cash_register') && (
                            <div className="flex flex-wrap gap-2 lg:flex-col">
                                <button type="button" onClick={() => { setTxnForm('cash_in'); setTxnAmount(''); setTxnNotes(''); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-herb/15 px-4 py-2.5 text-sm font-semibold text-herb">
                                    <Plus size={16} /> Cash in
                                </button>
                                <button type="button" onClick={() => { setTxnForm('cash_out'); setTxnAmount(''); setTxnNotes(''); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral/15 px-4 py-2.5 text-sm font-semibold text-coral">
                                    <Minus size={16} /> Cash out
                                </button>
                                <button type="button" onClick={() => { setCloseForm(true); setActualClosing(String(current.expected_closing ?? current.opening_amount ?? '')); setNotes(''); }} className="inline-flex items-center justify-center btn-primary">
                                    Close register
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold">No open register</p>
                            <p className="mt-1 text-sm text-ink/45">Start a drawer session before taking cash sales or expenses.</p>
                        </div>
                        {can('finance.cash_register') && (
                            <button type="button" onClick={() => setOpenForm(true)} className="btn-primary">
                                Open register
                            </button>
                        )}
                    </div>
                )}
            </article>

            {current?.transactions?.length > 0 && (
                <article className="mb-5 card-panel p-6">
                    <p className="mb-3 font-semibold">Session movements</p>
                    <div className="divide-y divide-ink/7">
                        {current.transactions.map((txn) => (
                            <div key={txn.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                                <div>
                                    <p className="font-medium capitalize">{String(txn.type).replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-ink/40">{formatDateTime(txn.created_at)}{txn.notes ? ` · ${txn.notes}` : ''}</p>
                                </div>
                                <p className={`font-semibold ${['cash_out', 'expense'].includes(txn.type) ? 'text-coral' : 'text-herb'}`}>
                                    {['cash_out', 'expense'].includes(txn.type) ? '−' : '+'}{currency(txn.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </article>
            )}

            <div className="mb-4 flex gap-2">
                {['', 'open', 'closed'].map((status) => (
                    <button
                        key={status || 'all'}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, status, page: 1 }))}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${filters.status === status ? 'bg-ink text-white' : 'bg-white'}`}
                    >
                        {status ? status.replace(/^./, (c) => c.toUpperCase()) : 'All sessions'}
                    </button>
                ))}
            </div>

            <DataTable
                loading={loading}
                emptyMessage="No register sessions yet."
                rows={rows}
                columns={[
                    { key: 'id', label: '#', render: (row) => `#${row.id}` },
                    { key: 'user', label: 'Cashier', render: (row) => row.user?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'opening_amount', label: 'Opening', render: (row) => currency(row.opening_amount) },
                    { key: 'actual_closing', label: 'Closing', render: (row) => (row.actual_closing != null ? currency(row.actual_closing) : '—') },
                    { key: 'difference', label: 'Diff', render: (row) => (row.difference != null ? <span className={Number(row.difference) === 0 ? '' : Number(row.difference) < 0 ? 'text-coral' : 'text-herb'}>{currency(row.difference)}</span> : '—') },
                    { key: 'opened_at', label: 'Opened', render: (row) => formatDateTime(row.opened_at) },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={openForm} title="Open cash register" description="Enter the starting float in the drawer." onClose={() => setOpenForm(false)} onSubmit={openRegister} busy={busy} submitLabel="Open">
                <label className="text-sm font-medium">Opening amount
                    <input required type="number" min="0" step="0.01" className="field mt-1" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                </label>
                <label className="mt-4 block text-sm font-medium">Notes
                    <textarea className="field mt-1 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
            </FormModal>

            <FormModal open={Boolean(txnForm)} title={txnForm === 'cash_in' ? 'Cash in' : 'Cash out'} description="Record a drawer movement for this session." onClose={() => setTxnForm(null)} onSubmit={postTransaction} busy={busy} submitLabel="Save">
                <label className="text-sm font-medium">Amount
                    <input required type="number" min="0.01" step="0.01" className="field mt-1" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} />
                </label>
                <label className="mt-4 block text-sm font-medium">Notes
                    <textarea className="field mt-1 min-h-20" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} />
                </label>
            </FormModal>

            <FormModal open={closeForm} title="Close cash register" description="Count the drawer and enter the actual cash on hand." onClose={() => setCloseForm(false)} onSubmit={closeRegister} busy={busy} submitLabel="Close register">
                <p className="mb-3 rounded-xl bg-ink/[.04] px-3 py-2 text-sm">Expected: <strong>{currency(current?.expected_closing ?? current?.opening_amount)}</strong></p>
                <label className="text-sm font-medium">Actual closing
                    <input required type="number" min="0" step="0.01" className="field mt-1" value={actualClosing} onChange={(e) => setActualClosing(e.target.value)} />
                </label>
                <label className="mt-4 block text-sm font-medium">Notes
                    <textarea className="field mt-1 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
            </FormModal>
        </div>
    );
}
