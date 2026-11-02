import { Copy, Eye, Plus, Shield, ToggleLeft, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DataTable from '../../../components/DataTable.jsx';
import FormModal from '../../../components/FormModal.jsx';
import PageHeader from '../../../components/PageHeader.jsx';
import SearchInput from '../../../components/SearchInput.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import { roleApi } from '../services/roleApi.js';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'system', label: 'System Roles' },
    { key: 'custom', label: 'Custom Roles' },
];

export default function RolesPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [cloneTarget, setCloneTarget] = useState(null);
    const [cloneName, setCloneName] = useState('');
    const [cloneBusy, setCloneBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ per_page: '100' });
            if (filter === 'active') params.set('is_active', '1');
            if (filter === 'inactive') params.set('is_active', '0');
            if (filter === 'system') params.set('type', 'system');
            if (filter === 'custom') params.set('type', 'custom');
            if (query.trim()) params.set('search', query.trim());
            const response = await roleApi.list(params.toString());
            setRows(response.data || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [filter]);

    useEffect(() => {
        const timer = setTimeout(() => load(), 250);
        return () => clearTimeout(timer);
    }, [query]);

    const customCount = useMemo(() => rows.filter((r) => !r.is_system).length, [rows]);

    async function toggleStatus(row) {
        if (row.slug === 'super_admin') {
            toast.error('Super Admin role cannot be disabled.');
            return;
        }
        try {
            await roleApi.setStatus(row.id, !row.is_active);
            toast.success(row.is_active ? 'Role disabled' : 'Role enabled');
            load();
        } catch (error) {
            toast.error(error.message);
        }
    }

    async function confirmClone(event) {
        event.preventDefault();
        setCloneBusy(true);
        try {
            const created = await roleApi.clone(cloneTarget.id, {
                name: cloneName.trim(),
                copy_permissions: true,
            });
            toast.success('Role cloned');
            setCloneTarget(null);
            navigate(`/roles/${created.data.id}/edit`);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCloneBusy(false);
        }
    }

    async function confirmDelete(event) {
        event.preventDefault();
        setDeleteBusy(true);
        try {
            await roleApi.remove(deleteTarget.id);
            toast.success('Role deleted');
            setDeleteTarget(null);
            load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setDeleteBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Roles & Permissions"
                description="Create roles and control access to every module in the system."
                breadcrumbs={['System Administration', 'Roles']}
                actions={(
                    <Link to="/roles/create" className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Create New Role
                    </Link>
                )}
            />

            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-md flex-1">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search role…" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setFilter(item.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item.key ? 'bg-ink text-white' : 'bg-white text-ink/60 soft-shadow'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {!loading && filter === 'custom' && customCount === 0 && rows.length === 0 && (
                <div className="mb-6 rounded-3xl bg-white p-10 text-center soft-shadow">
                    <Shield className="mx-auto text-herb" size={28} />
                    <h2 className="mt-3 text-lg font-semibold">No custom roles created yet.</h2>
                    <p className="mt-1 text-sm text-ink/50">Create a role and choose exactly which parts of the system it can access.</p>
                    <Link to="/roles/create" className="mt-5 inline-flex btn-primary">Create Role</Link>
                </div>
            )}

            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No roles found."
                columns={[
                    {
                        key: 'name',
                        label: 'Role Name',
                        render: (row) => (
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{row.name}</span>
                                    {row.slug === 'super_admin' && (
                                        <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-coral">System Protected</span>
                                    )}
                                </div>
                                <p className="text-xs text-ink/40">{row.slug}</p>
                            </div>
                        ),
                    },
                    {
                        key: 'description',
                        label: 'Description',
                        render: (row) => <span className="text-sm text-ink/65">{row.description || '—'}</span>,
                    },
                    {
                        key: 'type',
                        label: 'Type',
                        render: (row) => (
                            <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-medium">
                                {row.is_system ? 'System Role' : 'Custom Role'}
                            </span>
                        ),
                    },
                    {
                        key: 'permissions',
                        label: 'Permissions',
                        render: (row) => `${row.permissions?.length || 0} Permissions`,
                    },
                    {
                        key: 'users_count',
                        label: 'Assigned Users',
                        render: (row) => `${row.users_count ?? 0} Users`,
                    },
                    {
                        key: 'is_active',
                        label: 'Status',
                        render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} />,
                    },
                    {
                        key: 'created_at',
                        label: 'Created At',
                        render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '—',
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex flex-wrap justify-end gap-1">
                                <Link to={`/roles/${row.id}`} className="rounded-lg p-2 hover:bg-ink/5" title="View"><Eye size={15} /></Link>
                                <Link to={`/roles/${row.id}/edit`} className="rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-ink/5">Edit</Link>
                                <button type="button" className="rounded-lg p-2 hover:bg-ink/5" title="Clone" onClick={() => { setCloneTarget(row); setCloneName(`${row.name} Copy`); }}>
                                    <Copy size={15} />
                                </button>
                                <Link to={`/roles/${row.id}?tab=users`} className="rounded-lg p-2 hover:bg-ink/5" title="Users"><Users size={15} /></Link>
                                {row.slug !== 'super_admin' && (
                                    <button type="button" className="rounded-lg p-2 hover:bg-ink/5" title={row.is_active ? 'Disable' : 'Enable'} onClick={() => toggleStatus(row)}>
                                        <ToggleLeft size={15} />
                                    </button>
                                )}
                                {!row.is_system && (
                                    <button type="button" className="rounded-lg p-2 text-coral hover:bg-coral/5" title="Delete" onClick={() => setDeleteTarget(row)}>
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        ),
                    },
                ]}
            />

            <FormModal open={Boolean(cloneTarget)} title={cloneTarget ? `Clone Role: ${cloneTarget.name}` : 'Clone Role'} onClose={() => setCloneTarget(null)} onSubmit={confirmClone} busy={cloneBusy} submitLabel="Create Role">
                <label className="block text-sm">
                    <span className="mb-2 block font-medium">New Role Name</span>
                    <input className="field" required value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
                </label>
                <label className="mt-4 flex items-center gap-2 text-sm">
                    <input type="checkbox" defaultChecked disabled />
                    Copy all permissions
                </label>
            </FormModal>

            <FormModal open={Boolean(deleteTarget)} title="Delete role" onClose={() => setDeleteTarget(null)} onSubmit={confirmDelete} busy={deleteBusy} submitLabel="Delete">
                <p className="text-sm text-ink/70">
                    Delete role &ldquo;{deleteTarget?.name}&rdquo;?
                </p>
                <p className="mt-2 text-sm text-ink/50">This action cannot be undone.</p>
                {(deleteTarget?.users_count || 0) > 0 && (
                    <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
                        Role &ldquo;{deleteTarget?.name}&rdquo; is assigned to {deleteTarget.users_count} users. Reassign them before deleting.
                    </p>
                )}
            </FormModal>
        </div>
    );
}
