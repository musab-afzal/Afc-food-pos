import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../services/api.js';

export default function RolesPage() {
    const [rows, setRows] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        name: '', slug: '', max_discount_percent: 0, is_active: true, permission_ids: [],
    });

    async function load() {
        setLoading(true);
        try {
            const [rolesResponse, permissionsResponse] = await Promise.all([
                api('/roles?per_page=100'),
                api('/permissions'),
            ]);
            setRows(rolesResponse.data || []);
            setPermissions(permissionsResponse.data || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setEditing(null);
        setForm({ name: '', slug: '', max_discount_percent: 0, is_active: true, permission_ids: [] });
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            name: row.name,
            slug: row.slug,
            max_discount_percent: row.max_discount_percent,
            is_active: row.is_active,
            permission_ids: (row.permissions || []).map((item) => item.id || item),
        });
        setOpen(true);
    }

    function togglePermission(id) {
        setForm((current) => ({
            ...current,
            permission_ids: current.permission_ids.includes(id)
                ? current.permission_ids.filter((item) => item !== id)
                : [...current.permission_ids, id],
        }));
    }

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        try {
            if (editing) {
                await api(`/roles/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
                toast.success('Role updated');
            } else {
                await api('/roles', { method: 'POST', body: JSON.stringify(form) });
                toast.success('Role created');
            }
            setOpen(false);
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    const grouped = permissions.reduce((acc, permission) => {
        const module = permission.module || 'General';
        acc[module] = acc[module] || [];
        acc[module].push(permission);
        return acc;
    }, {});

    return (
        <div>
            <PageHeader
                title="Roles"
                description="Define access levels and maximum discount authority."
                breadcrumbs={['Staff', 'Roles']}
                actions={(
                    <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add role
                    </button>
                )}
            />

            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No roles configured."
                columns={[
                    { key: 'name', label: 'Role' },
                    { key: 'slug', label: 'Slug' },
                    { key: 'max_discount_percent', label: 'Max discount', render: (row) => `${row.max_discount_percent}%` },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <button type="button" onClick={() => openEdit(row)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink/5">
                                Edit
                            </button>
                        ),
                    },
                ]}
            />

            <FormModal open={open} title={editing ? 'Edit role' : 'Add role'} onClose={() => setOpen(false)} onSubmit={save} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Name</span>
                        <input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : e.target.value.toLowerCase().replace(/\s+/g, '_') })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Slug</span>
                        <input className="field" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Max discount %</span>
                        <input className="field" type="number" min="0" max="100" value={form.max_discount_percent} onChange={(e) => setForm({ ...form, max_discount_percent: e.target.value })} />
                    </label>
                    <label className="flex items-end gap-3 pb-2 text-sm">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                        Active
                    </label>
                </div>
                <div className="mt-6 max-h-80 space-y-4 overflow-y-auto rounded-2xl border border-ink/8 p-4">
                    {Object.entries(grouped).map(([module, items]) => (
                        <div key={module}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/40">{module}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {items.map((permission) => (
                                    <label key={permission.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-ink/[.03]">
                                        <input
                                            type="checkbox"
                                            checked={form.permission_ids.includes(permission.id)}
                                            onChange={() => togglePermission(permission.id)}
                                        />
                                        {permission.name || permission.slug}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </FormModal>
        </div>
    );
}
