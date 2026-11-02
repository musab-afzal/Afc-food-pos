import { Edit3, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import ListFilters from '../../components/ListFilters.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const emptyForm = {
    name: '', phone: '', alternate_mobile: '', email: '', address: '', city: '',
    customer_group_id: '', loyalty_points: 0, is_active: true, notes: '',
};

export default function CustomersPage() {
    const { can } = useAuth();
    const [groups, setGroups] = useState([]);
    const [filters, setFilters] = useState({ search: '', customer_group_id: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/customers', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/customer-groups?per_page=100').then((r) => setGroups(r.data || [])).catch(() => {});
    }, []);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            name: row.name,
            phone: row.phone || '',
            alternate_mobile: row.alternate_mobile || '',
            email: row.email || '',
            address: row.address || '',
            city: row.city || '',
            customer_group_id: row.customer_group_id || '',
            loyalty_points: row.loyalty_points || 0,
            is_active: row.is_active,
            notes: row.notes || '',
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/customers/${editing.id}` : '/customers', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...form,
                    customer_group_id: form.customer_group_id || null,
                    email: form.email || null,
                    phone: form.phone || null,
                }),
            });
            toast.success(editing ? 'Customer updated' : 'Customer created');
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
            await api(`/customers/${deleting.id}`, { method: 'DELETE' });
            toast.success('Customer archived');
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
                title="Customers"
                description="Guest profiles, groups, and loyalty balances."
                breadcrumbs={['Customers', 'List']}
                actions={can('customers.create') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add customer
                    </button>
                )}
            />
            <ListFilters
                search={filters.search}
                onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
                searchPlaceholder="Search name, phone, code…"
                dateFrom={filters.date_from}
                dateTo={filters.date_to}
                onDateFrom={(date_from) => setFilters((f) => ({ ...f, date_from, page: 1 }))}
                onDateTo={(date_to) => setFilters((f) => ({ ...f, date_to, page: 1 }))}
            >
                <select className="field max-w-[200px]" value={filters.customer_group_id} onChange={(e) => setFilters((f) => ({ ...f, customer_group_id: e.target.value, page: 1 }))}>
                    <option value="">All groups</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </ListFilters>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No customers yet."
                columns={[
                    { key: 'name', label: 'Customer', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">{row.customer_code}</p></div> },
                    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
                    { key: 'group', label: 'Group', render: (row) => row.group?.name || '—' },
                    { key: 'loyalty_points', label: 'Points' },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-1">
                                <Link to={`/customers/${row.id}`} className="rounded-lg px-3 py-1.5 text-sm hover:bg-ink/5">View</Link>
                                {can('customers.edit') && <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>}
                                {can('customers.delete') && <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit customer' : 'Add customer'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Group</span>
                        <select className="field" value={form.customer_group_id} onChange={(e) => setForm({ ...form, customer_group_id: e.target.value })}>
                            <option value="">None</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Phone</span><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Alternate mobile</span><input className="field" value={form.alternate_mobile} onChange={(e) => setForm({ ...form, alternate_mobile: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Email</span><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">City</span><input className="field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Address</span><textarea className="field min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Notes</span><textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive customer?" message="Order history stays linked." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </div>
    );
}
