import { Edit3, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const emptyForm = {
    name: '', contact_person: '', phone: '', email: '', address: '',
    opening_balance: 0, is_active: true, notes: '',
};

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function SuppliersPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/suppliers', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            name: row.name,
            contact_person: row.contact_person || '',
            phone: row.phone || '',
            email: row.email || '',
            address: row.address || '',
            opening_balance: row.opening_balance || 0,
            is_active: row.is_active,
            notes: row.notes || '',
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/suppliers/${editing.id}` : '/suppliers', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...form,
                    email: form.email || null,
                    phone: form.phone || null,
                    opening_balance: Number(form.opening_balance) || 0,
                }),
            });
            toast.success(editing ? 'Supplier updated' : 'Supplier created');
            setOpen(false);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            await api(`/suppliers/${deleting.id}`, { method: 'DELETE' });
            toast.success('Supplier archived');
            setDeleting(null);
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
                title="Suppliers"
                description="Vendor directory for purchase orders and payables."
                breadcrumbs={['Purchases', 'Suppliers']}
                actions={can('suppliers.manage') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add supplier
                    </button>
                )}
            />
            <div className="mb-4">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search suppliers…" />
            </div>
            <DataTable
                loading={loading}
                emptyMessage="No suppliers yet."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Supplier', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">{row.contact_person || '—'}</p></div> },
                    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
                    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
                    { key: 'current_payable', label: 'Payable', render: (row) => money(row.current_payable) },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('suppliers.manage') && (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit supplier' : 'Add supplier'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Contact person</span><input className="field" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Phone</span><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Email</span><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    {!editing && (
                        <label className="block text-sm"><span className="mb-2 block font-medium">Opening balance</span><input className="field" type="number" min="0" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></label>
                    )}
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Address</span><textarea className="field min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Notes</span><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive supplier?" message="Existing purchase history stays linked." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
