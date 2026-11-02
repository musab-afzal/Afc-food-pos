import { Edit3, Plus } from 'lucide-react';
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

const emptyForm = { name: '', discount_percent: 0, description: '', is_active: true };

export default function CustomerGroupsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/customer-groups', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            name: row.name,
            discount_percent: row.discount_percent,
            description: row.description || '',
            is_active: row.is_active,
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/customer-groups/${editing.id}` : '/customer-groups', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });
            toast.success(editing ? 'Group updated' : 'Group created');
            setOpen(false);
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
                title="Customer Groups"
                description="VIP, corporate, and other guest segments."
                breadcrumbs={['Customers', 'Groups']}
                actions={can('customers.edit') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add group
                    </button>
                )}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} />
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No customer groups yet."
                columns={[
                    { key: 'name', label: 'Group' },
                    { key: 'discount_percent', label: 'Discount', render: (row) => `${Number(row.discount_percent)}%` },
                    { key: 'customers_count', label: 'Customers', render: (row) => row.customers_count ?? 0 },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('customers.edit') && (
                            <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit group' : 'Add group'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy}>
                <div className="space-y-4">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Discount %</span><input className="field" type="number" min="0" max="100" step="any" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Description</span><textarea className="field min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
        </div>
    );
}
