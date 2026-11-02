import { Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';
import { currency, formatDate } from '../../utils/format.js';

const empty = {
    code: '',
    name: '',
    type: 'percent',
    value: '',
    min_order: '0',
    max_discount: '',
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    total_usage_limit: '',
    per_customer_limit: '',
    is_active: true,
};

export default function CouponsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/coupons', filters);
    const [open, setOpen] = useState(false);
    const [validateOpen, setValidateOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);
    const [validateForm, setValidateForm] = useState({ code: '', order_total: '1000' });
    const [validateResult, setValidateResult] = useState(null);

    function openCreate() {
        setEditing(null);
        setForm({ ...empty, start_date: new Date().toISOString().slice(0, 10) });
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            code: row.code,
            name: row.name,
            type: row.type,
            value: String(row.value ?? ''),
            min_order: String(row.min_order ?? 0),
            max_discount: row.max_discount != null ? String(row.max_discount) : '',
            start_date: row.start_date ? String(row.start_date).slice(0, 10) : '',
            expiry_date: row.expiry_date ? String(row.expiry_date).slice(0, 10) : '',
            total_usage_limit: row.total_usage_limit != null ? String(row.total_usage_limit) : '',
            per_customer_limit: row.per_customer_limit != null ? String(row.per_customer_limit) : '',
            is_active: Boolean(row.is_active),
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/coupons/${editing.id}` : '/coupons';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    code: form.code.toUpperCase(),
                    name: form.name,
                    type: form.type,
                    value: Number(form.value),
                    min_order: Number(form.min_order) || 0,
                    max_discount: form.max_discount === '' ? null : Number(form.max_discount),
                    start_date: form.start_date,
                    expiry_date: form.expiry_date,
                    total_usage_limit: form.total_usage_limit === '' ? null : Number(form.total_usage_limit),
                    per_customer_limit: form.per_customer_limit === '' ? null : Number(form.per_customer_limit),
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success(editing ? 'Coupon updated' : 'Coupon created');
            setOpen(false);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function validate(event) {
        event.preventDefault();
        setBusy(true);
        setValidateResult(null);
        try {
            const response = await api('/coupons/validate', {
                method: 'POST',
                body: JSON.stringify({
                    code: validateForm.code,
                    order_total: Number(validateForm.order_total),
                }),
            });
            setValidateResult(response.data);
            toast.success('Coupon is valid');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Coupons"
                description="Promo codes with usage and customer limits."
                breadcrumbs={['Promotions', 'Coupons']}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setValidateOpen(true); setValidateResult(null); setValidateForm({ code: '', order_total: '1000' }); }} className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <ShieldCheck size={16} /> Validate
                        </button>
                        {(can('coupons.manage') || can('promotions.manage')) && (
                            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 btn-primary">
                                <Plus size={16} /> New coupon
                            </button>
                        )}
                    </div>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Code or name…" className="min-w-[220px] flex-1" />
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.is_active} onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value, page: 1 }))}>
                    <option value="">All</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No coupons yet."
                rows={rows}
                columns={[
                    { key: 'code', label: 'Code', render: (row) => <span className="font-semibold tracking-wide">{row.code}</span> },
                    { key: 'name', label: 'Name' },
                    { key: 'value', label: 'Value', render: (row) => (row.type === 'percent' ? `${row.value}%` : currency(row.value)) },
                    { key: 'window', label: 'Valid', render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.expiry_date)}` },
                    { key: 'used_count', label: 'Used', render: (row) => `${row.used_count || 0}${row.total_usage_limit != null ? ` / ${row.total_usage_limit}` : ''}` },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || (row.is_active ? 'active' : 'inactive')} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (can('coupons.manage') || can('promotions.manage')) && (
                            <button type="button" onClick={() => openEdit(row)} className="text-sm font-semibold text-herb">Edit</button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title={editing ? 'Edit coupon' : 'Create coupon'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Code
                        <input required className="field mt-1 uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={Boolean(editing)} />
                    </label>
                    <label className="text-sm font-medium">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Type
                        <select className="field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option value="percent">Percent</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">Value
                        <input required type="number" min="0" step="0.01" className="field mt-1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Min order
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Max discount
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Start
                        <input required type="date" className="field mt-1" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Expiry
                        <input required type="date" className="field mt-1" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Total usage limit
                        <input type="number" min="0" className="field mt-1" value={form.total_usage_limit} onChange={(e) => setForm({ ...form, total_usage_limit: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Per customer limit
                        <input type="number" min="0" className="field mt-1" value={form.per_customer_limit} onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>

            <FormModal open={validateOpen} title="Validate coupon" description="Dry-run check without consuming the code." onClose={() => setValidateOpen(false)} onSubmit={validate} busy={busy} submitLabel="Validate">
                <label className="text-sm font-medium">Code
                    <input required className="field mt-1 uppercase" value={validateForm.code} onChange={(e) => setValidateForm({ ...validateForm, code: e.target.value.toUpperCase() })} />
                </label>
                <label className="mt-4 block text-sm font-medium">Order total
                    <input required type="number" min="0" step="0.01" className="field mt-1" value={validateForm.order_total} onChange={(e) => setValidateForm({ ...validateForm, order_total: e.target.value })} />
                </label>
                {validateResult && (
                    <div className="mt-4 rounded-2xl bg-herb/10 px-4 py-3 text-sm">
                        <p>Discount: <strong>{currency(validateResult.discount_amount)}</strong></p>
                        <p className="mt-1">Payable: <strong>{currency(validateResult.payable_total)}</strong></p>
                    </div>
                )}
            </FormModal>
        </div>
    );
}
