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

const emptyForm = { name: '', short_name: '', type: 'count', conversion_factor: 1, is_active: true };

export default function UnitsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/units', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);

    function openForm(unit = null) {
        setEditing(unit);
        setForm(unit ? {
            name: unit.name,
            short_name: unit.short_name,
            type: unit.type,
            conversion_factor: unit.conversion_factor,
            is_active: unit.is_active,
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/units/${editing.id}` : '/units', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });
            toast.success(editing ? 'Unit updated' : 'Unit created');
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
                title="Units"
                description="Purchase and consumption units used across inventory and recipes."
                breadcrumbs={['Inventory', 'Units']}
                actions={can('inventory.create') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add unit
                    </button>
                )}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search units…" />
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No units configured."
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'short_name', label: 'Short' },
                    { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
                    { key: 'conversion_factor', label: 'Conversion' },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('inventory.edit') && (
                            <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit unit' : 'Add unit'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name"><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="Short name"><input className="field" required value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></Field>
                    <Field label="Type">
                        <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option value="count">Count</option>
                            <option value="weight">Weight</option>
                            <option value="volume">Volume</option>
                        </select>
                    </Field>
                    <Field label="Conversion factor"><input className="field" type="number" step="any" min="0" required value={form.conversion_factor} onChange={(e) => setForm({ ...form, conversion_factor: e.target.value })} /></Field>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block text-sm"><span className="mb-2 block font-medium">{label}</span>{children}</label>;
}
