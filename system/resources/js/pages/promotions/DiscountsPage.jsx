import { Plus } from 'lucide-react';
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
    name: '',
    type: 'percent',
    value: '',
    applies_to: 'order',
    start_date: '',
    end_date: '',
    min_order: '0',
    max_discount: '',
    usage_limit: '',
    is_active: true,
};

export default function DiscountsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/discounts', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);

    function openCreate() {
        setEditing(null);
        setForm(empty);
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            name: row.name,
            type: row.type,
            value: String(row.value ?? ''),
            applies_to: row.applies_to || 'order',
            start_date: row.start_date ? String(row.start_date).slice(0, 10) : '',
            end_date: row.end_date ? String(row.end_date).slice(0, 10) : '',
            min_order: String(row.min_order ?? 0),
            max_discount: row.max_discount != null ? String(row.max_discount) : '',
            usage_limit: row.usage_limit != null ? String(row.usage_limit) : '',
            is_active: Boolean(row.is_active),
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/discounts/${editing.id}` : '/discounts';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name: form.name,
                    type: form.type,
                    value: Number(form.value),
                    applies_to: form.applies_to,
                    start_date: form.start_date || null,
                    end_date: form.end_date || null,
                    min_order: Number(form.min_order) || 0,
                    max_discount: form.max_discount === '' ? null : Number(form.max_discount),
                    usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success(editing ? 'Discount updated' : 'Discount created');
            setOpen(false);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Discounts"
                description="Automatic or staff-applied order and item discounts."
                breadcrumbs={['Promotions', 'Discounts']}
                actions={(can('discounts.manage') || can('promotions.manage')) && (
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> New discount
                    </button>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search discounts…" className="min-w-[220px] flex-1" />
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.is_active} onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value, page: 1 }))}>
                    <option value="">All</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No discounts yet."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'value', label: 'Value', render: (row) => (row.type === 'percent' ? `${row.value}%` : currency(row.value)) },
                    { key: 'applies_to', label: 'Applies', render: (row) => <span className="capitalize">{row.applies_to}</span> },
                    { key: 'window', label: 'Window', render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.end_date)}` },
                    { key: 'used_count', label: 'Used', render: (row) => `${row.used_count || 0}${row.usage_limit != null ? ` / ${row.usage_limit}` : ''}` },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || (row.is_active ? 'active' : 'inactive')} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (can('discounts.manage') || can('promotions.manage')) && (
                            <button type="button" onClick={() => openEdit(row)} className="text-sm font-semibold text-herb">Edit</button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title={editing ? 'Edit discount' : 'Create discount'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Name
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
                    <label className="text-sm font-medium">Applies to
                        <select className="field mt-1" value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })}>
                            <option value="order">Order</option>
                            <option value="item">Item</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium">Min order
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Start date
                        <input type="date" className="field mt-1" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">End date
                        <input type="date" className="field mt-1" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Max discount
                        <input type="number" min="0" step="0.01" className="field mt-1" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Usage limit
                        <input type="number" min="0" className="field mt-1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
