import { Check, Eye, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDate } from '../../utils/format.js';

function monthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

const empty = {
    rider_id: '',
    period_start: monthStart(),
    period_end: today(),
    commission: '',
    paid_to_restaurant: '',
    notes: '',
};

export default function SettlementsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ status: '', rider_id: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/rider-settlements', filters);
    const [riders, setRiders] = useState([]);
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState(null);
    const [detail, setDetail] = useState(null);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [form, setForm] = useState(empty);

    useEffect(() => {
        api('/riders?per_page=100&is_active=1').then((r) => setRiders(r.data || [])).catch(() => {});
    }, []);

    async function loadPreview() {
        if (!form.rider_id || !form.period_start || !form.period_end) return;
        try {
            const response = await api(`/rider-settlements/preview?rider_id=${form.rider_id}&period_start=${form.period_start}&period_end=${form.period_end}`);
            setPreview(response.data);
            setForm((current) => ({
                ...current,
                commission: current.commission === '' ? String(response.data.suggested_commission ?? response.data.commission ?? 0) : current.commission,
                paid_to_restaurant: current.paid_to_restaurant === ''
                    ? String(Math.max(0, Number(response.data.total_cod || 0) - Number(response.data.suggested_commission ?? response.data.commission ?? 0)))
                    : current.paid_to_restaurant,
            }));
        } catch (err) {
            toast.error(err.message);
            setPreview(null);
        }
    }

    useEffect(() => {
        if (open && form.rider_id) {
            const timer = setTimeout(loadPreview, 200);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [open, form.rider_id, form.period_start, form.period_end]);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/rider-settlements', {
                method: 'POST',
                body: JSON.stringify({
                    rider_id: Number(form.rider_id),
                    period_start: form.period_start,
                    period_end: form.period_end,
                    commission: Number(form.commission || 0),
                    paid_to_restaurant: Number(form.paid_to_restaurant || 0),
                    notes: form.notes || null,
                }),
            });
            toast.success('Settlement draft created');
            setOpen(false);
            setForm(empty);
            setPreview(null);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function settle(row) {
        setBusyId(row.id);
        try {
            await api(`/rider-settlements/${row.id}/settle`, { method: 'POST', body: '{}' });
            toast.success(`${row.settlement_number} settled`);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function cancel(row) {
        setBusyId(row.id);
        try {
            await api(`/rider-settlements/${row.id}/cancel`, { method: 'POST', body: '{}' });
            toast.success(`${row.settlement_number} cancelled`);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function showDetail(row) {
        try {
            const response = await api(`/rider-settlements/${row.id}`);
            setDetail(response.data);
        } catch (err) {
            toast.error(err.message);
        }
    }

    return (
        <div>
            <PageHeader
                title="Rider settlements"
                description="COD collection periods, commission, and amounts paid to the restaurant."
                breadcrumbs={['Delivery', 'Settlements']}
                actions={can('riders.settle') && (
                    <button type="button" onClick={() => { setForm(empty); setPreview(null); setOpen(true); }} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> New settlement
                    </button>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.rider_id} onChange={(e) => setFilters((f) => ({ ...f, rider_id: e.target.value, page: 1 }))}>
                    <option value="">All riders</option>
                    {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
                </select>
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="settled">Settled</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No settlements yet."
                rows={rows}
                columns={[
                    { key: 'settlement_number', label: 'Number', render: (row) => <span className="font-semibold">{row.settlement_number}</span> },
                    { key: 'rider', label: 'Rider', render: (row) => row.rider?.name || '—' },
                    { key: 'period', label: 'Period', render: (row) => `${formatDate(row.period_start)} → ${formatDate(row.period_end)}` },
                    { key: 'total_cod', label: 'COD', className: 'text-right', render: (row) => currency(row.total_cod) },
                    { key: 'commission', label: 'Commission', className: 'text-right', render: (row) => currency(row.commission) },
                    { key: 'paid_to_restaurant', label: 'Paid in', className: 'text-right', render: (row) => currency(row.paid_to_restaurant) },
                    { key: 'balance', label: 'Balance', className: 'text-right', render: (row) => currency(row.balance) },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => showDetail(row)} className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60">
                                    <Eye size={14} /> View
                                </button>
                                {row.status === 'draft' && can('riders.settle') && (
                                    <>
                                        <button type="button" disabled={busyId === row.id} onClick={() => settle(row)} className="inline-flex items-center gap-1 rounded-lg bg-herb/15 px-2.5 py-1 text-xs font-semibold text-herb disabled:opacity-40">
                                            <Check size={14} /> Settle
                                        </button>
                                        <button type="button" disabled={busyId === row.id} onClick={() => cancel(row)} className="inline-flex items-center gap-1 rounded-lg bg-coral/15 px-2.5 py-1 text-xs font-semibold text-coral disabled:opacity-40">
                                            <X size={14} /> Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Create settlement" description="COD from delivered jobs in the selected period." onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Save draft" wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Rider
                        <select required className="field mt-1" value={form.rider_id} onChange={(e) => setForm({ ...form, rider_id: e.target.value, commission: '', paid_to_restaurant: '' })}>
                            <option value="">Select…</option>
                            {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-medium">Period start
                        <input required type="date" className="field mt-1" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Period end
                        <input required type="date" className="field mt-1" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
                    </label>
                    {preview && (
                        <div className="sm:col-span-2 rounded-2xl bg-ink/[.04] px-4 py-3 text-sm">
                            <p><strong>{preview.deliveries_count ?? preview.delivery_count ?? 0}</strong> delivered jobs · COD <strong>{currency(preview.total_cod)}</strong></p>
                        </div>
                    )}
                    <label className="text-sm font-medium">Commission
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Paid to restaurant
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.paid_to_restaurant} onChange={(e) => setForm({ ...form, paid_to_restaurant: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Notes
                        <textarea className="field mt-1 min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </label>
                </div>
            </FormModal>

            <FormModal open={Boolean(detail)} title={detail?.settlement_number || 'Settlement'} description={`${detail?.rider?.name || ''} · ${formatDate(detail?.period_start)} → ${formatDate(detail?.period_end)}`} onClose={() => setDetail(null)} onSubmit={(e) => { e.preventDefault(); setDetail(null); }} busy={false} submitLabel="Close">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <p>COD: <strong>{currency(detail?.total_cod)}</strong></p>
                    <p>Commission: <strong>{currency(detail?.commission)}</strong></p>
                    <p>Paid in: <strong>{currency(detail?.paid_to_restaurant)}</strong></p>
                    <p>Balance: <strong>{currency(detail?.balance)}</strong></p>
                </div>
                <div className="mt-4 max-h-56 overflow-y-auto divide-y divide-ink/7">
                    {(detail?.deliveries || []).map((delivery) => (
                        <div key={delivery.id} className="flex justify-between py-2 text-sm">
                            <span>#{delivery.id} · {delivery.status}</span>
                            <span className="font-semibold">{currency(delivery.cod_amount)}</span>
                        </div>
                    ))}
                    {!detail?.deliveries?.length && <p className="py-6 text-center text-sm text-ink/40">No delivery rows attached.</p>}
                </div>
            </FormModal>
        </div>
    );
}
