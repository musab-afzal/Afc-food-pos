import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const empty = { name: '', code: '', is_active: true, requires_reference: false, works_offline: false, sort_order: 0 };

export default function PaymentMethodsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/payment-methods', filters);
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
            code: row.code || '',
            is_active: Boolean(row.is_active),
            requires_reference: Boolean(row.requires_reference),
            works_offline: Boolean(row.works_offline),
            sort_order: row.sort_order ?? 0,
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/payment-methods/${editing.id}` : '/payment-methods';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name: form.name,
                    code: form.code,
                    is_active: Boolean(form.is_active),
                    requires_reference: Boolean(form.requires_reference),
                    works_offline: Boolean(form.works_offline),
                    sort_order: Number(form.sort_order) || 0,
                }),
            });
            toast.success(editing ? 'Payment method updated' : 'Payment method created');
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
                title="Payment methods"
                description="Tender types available on POS and finance postings."
                breadcrumbs={['Finance', 'Payment methods']}
                actions={can('finance.payment') && (
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add method
                    </button>
                )}
            />

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No payment methods."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'code', label: 'Code', render: (row) => row.code || '—' },
                    { key: 'requires_reference', label: 'Ref?', render: (row) => (row.requires_reference ? 'Yes' : 'No') },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('finance.payment') && (
                            <button type="button" onClick={() => openEdit(row)} className="text-sm font-semibold text-herb">Edit</button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title={editing ? 'Edit payment method' : 'Add payment method'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Code
                        <input required className="field mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={Boolean(editing)} />
                    </label>
                    <label className="text-sm font-medium">Sort order
                        <input type="number" className="field mt-1" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                    </label>
                    <div className="grid gap-2 self-end text-sm font-medium sm:col-span-2">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_reference} onChange={(e) => setForm({ ...form, requires_reference: e.target.checked })} /> Requires reference</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.works_offline} onChange={(e) => setForm({ ...form, works_offline: e.target.checked })} /> Works offline</label>
                    </div>
                </div>
            </FormModal>
        </div>
    );
}
