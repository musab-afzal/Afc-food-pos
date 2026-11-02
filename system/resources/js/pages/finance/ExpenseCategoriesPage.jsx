import { Edit3, Plus, Trash2 } from 'lucide-react';
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

const empty = { name: '', is_active: true };

export default function ExpenseCategoriesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/expense-categories', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? { name: row.name, is_active: Boolean(row.is_active) } : empty);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/expense-categories/${editing.id}` : '/expense-categories', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({ name: form.name, is_active: Boolean(form.is_active) }),
            });
            toast.success(editing ? 'Category updated' : 'Category created');
            setOpen(false);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            await api(`/expense-categories/${deleting.id}`, { method: 'DELETE' });
            toast.success('Category deleted');
            setDeleting(null);
            reload();
        } catch (err) {
            toast.error(err.message);
            setDeleting(null);
        } finally {
            setBusy(false);
        }
    }

    const canManage = can('expenses.manage');

    return (
        <div>
            <PageHeader
                title="Expense categories"
                description="Classify operating costs for reporting. Categories with expenses can be deactivated but not deleted."
                breadcrumbs={['Finance', 'Expense categories']}
                actions={canManage && (
                    <button type="button" onClick={() => openForm()} className="inline-flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add category
                    </button>
                )}
            />

            <div className="mb-4 max-w-md">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search categories…" />
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No expense categories yet."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'expenses_count', label: 'Expenses', render: (row) => row.expenses_count ?? 0 },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => canManage && (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5" aria-label="Edit"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-2 text-coral hover:bg-coral/5" aria-label="Delete"><Trash2 size={16} /></button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title={editing ? 'Edit expense category' : 'Add expense category'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'}>
                <div className="space-y-4">
                    <label className="block text-sm font-medium">Name
                        <input required maxLength={150} className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete category?"
                message={deleting ? `"${deleting.name}" will be permanently removed. This only works if it has no expenses.` : ''}
                confirmLabel="Delete"
                busy={busy}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
            />
        </div>
    );
}
