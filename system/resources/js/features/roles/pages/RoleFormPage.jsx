import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../../components/PageHeader.jsx';
import PermissionMatrix from '../components/PermissionMatrix.jsx';
import { roleApi } from '../services/roleApi.js';

const PRESETS = [
    { key: '', label: 'Empty Role' },
    { key: 'admin', label: 'Admin' },
    { key: 'manager', label: 'Manager' },
    { key: 'cashier', label: 'Cashier' },
    { key: 'waiter', label: 'Waiter' },
    { key: 'chef', label: 'Chef' },
    { key: 'inventory_manager', label: 'Inventory Manager' },
    { key: 'accountant', label: 'Accountant' },
    { key: 'rider', label: 'Rider' },
];

export default function RoleFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [confirmImpact, setConfirmImpact] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        max_discount_percent: 0,
        is_active: true,
        permission_ids: [],
    });
    const [roleMeta, setRoleMeta] = useState(null);

    const isSuperAdminRole = roleMeta?.slug === 'super_admin';

    useEffect(() => {
        async function boot() {
            setLoading(true);
            try {
                const [permRes, rolesRes] = await Promise.all([
                    roleApi.permissions(),
                    roleApi.list('per_page=100'),
                ]);
                setPermissions(permRes.data || []);
                setRoles(rolesRes.data || []);
                if (isEdit) {
                    const roleRes = await roleApi.get(id);
                    const role = roleRes.data;
                    setRoleMeta(role);
                    setForm({
                        name: role.name,
                        description: role.description || '',
                        max_discount_percent: role.max_discount_percent ?? 0,
                        is_active: role.is_active,
                        permission_ids: (role.permissions || []).map((p) => p.id),
                    });
                }
            } catch (error) {
                toast.error(error.message);
            } finally {
                setLoading(false);
            }
        }
        boot();
    }, [id, isEdit]);

    useEffect(() => {
        const onBeforeUnload = (event) => {
            if (!dirty || busy) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty, busy]);

    function updateForm(patch) {
        setForm((current) => ({ ...current, ...patch }));
        setDirty(true);
    }

    function applyPreset(slug) {
        if (!slug) {
            updateForm({ permission_ids: [] });
            return;
        }
        const preset = roles.find((r) => r.slug === slug);
        if (!preset) {
            toast.error('Preset role not found');
            return;
        }
        updateForm({ permission_ids: (preset.permissions || []).map((p) => p.id) });
    }

    const modulesTouched = useMemo(() => {
        const selected = new Set(form.permission_ids);
        const modules = new Set();
        for (const p of permissions) {
            if (selected.has(p.id)) modules.add(p.module);
        }
        return modules.size;
    }, [form.permission_ids, permissions]);

    async function persist() {
        setBusy(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                max_discount_percent: Number(form.max_discount_percent) || 0,
                is_active: form.is_active,
                permission_ids: form.permission_ids,
            };
            if (isEdit) {
                await roleApi.update(id, payload);
                toast.success('Role updated');
                setDirty(false);
                setConfirmImpact(false);
                navigate(`/roles/${id}`);
            } else {
                const created = await roleApi.create(payload);
                toast.success('Role created');
                setDirty(false);
                navigate(`/roles/${created.data.id}`);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function save(event) {
        event.preventDefault();
        if (isEdit && (roleMeta?.users_count || 0) > 0 && !confirmImpact) {
            setConfirmImpact(true);
            return;
        }
        await persist();
    }

    if (loading) {
        return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-white" />)}</div>;
    }

    return (
        <form onSubmit={save} className="pb-24">
            <PageHeader
                title={isEdit ? `Edit Role: ${roleMeta?.name || ''}` : 'Create Role'}
                description={isSuperAdminRole ? 'Super Admin has unrestricted system access.' : 'Define the role and select module permissions.'}
                breadcrumbs={['System Administration', 'Roles', isEdit ? 'Edit' : 'Create']}
                actions={(
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold"
                            onClick={() => {
                                if (dirty && !window.confirm('You have unsaved changes.\n\nLeave this page?')) return;
                                navigate(isEdit ? `/roles/${id}` : '/roles');
                            }}
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
                            {busy ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                )}
            />

            <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4 card-panel p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm sm:col-span-2">
                            <span className="mb-2 block font-medium">Role Name *</span>
                            <input
                                className="field"
                                required
                                disabled={isSuperAdminRole}
                                value={form.name}
                                onChange={(e) => updateForm({ name: e.target.value })}
                            />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                            <span className="mb-2 block font-medium">Description</span>
                            <textarea
                                className="field min-h-24"
                                value={form.description}
                                onChange={(e) => updateForm({ description: e.target.value })}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-2 block font-medium">Max discount %</span>
                            <input
                                className="field"
                                type="number"
                                min="0"
                                max="100"
                                disabled={isSuperAdminRole}
                                value={form.max_discount_percent}
                                onChange={(e) => updateForm({ max_discount_percent: e.target.value })}
                            />
                        </label>
                        <label className="flex items-end gap-3 pb-2 text-sm">
                            <input
                                type="checkbox"
                                disabled={isSuperAdminRole}
                                checked={form.is_active}
                                onChange={(e) => updateForm({ is_active: e.target.checked })}
                            />
                            Active
                        </label>
                        {!isEdit && (
                            <label className="block text-sm sm:col-span-2">
                                <span className="mb-2 block font-medium">Start From</span>
                                <select className="field" defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                                    {PRESETS.map((preset) => (
                                        <option key={preset.key || 'empty'} value={preset.key}>{preset.label}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                </div>

                <aside className="card-panel p-5">
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">Role Summary</p>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-3"><dt className="text-ink/45">Role</dt><dd className="font-medium">{form.name || '—'}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink/45">Status</dt><dd className="font-medium">{form.is_active ? 'Active' : 'Inactive'}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink/45">Modules</dt><dd className="font-medium">{modulesTouched}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink/45">Permissions</dt><dd className="font-medium">{form.permission_ids.length}</dd></div>
                        {isEdit && <div className="flex justify-between gap-3"><dt className="text-ink/45">Users</dt><dd className="font-medium">{roleMeta?.users_count ?? 0}</dd></div>}
                    </dl>
                </aside>
            </div>

            <div className="card-panel p-5">
                <h2 className="mb-4 text-base font-semibold">Permission Matrix</h2>
                <PermissionMatrix
                    permissions={permissions}
                    selectedIds={form.permission_ids}
                    readOnly={isSuperAdminRole}
                    onChange={(permission_ids) => updateForm({ permission_ids })}
                />
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                    <p className="text-sm text-ink/50">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
                            onClick={() => {
                                if (dirty && !window.confirm('You have unsaved changes.\n\nLeave this page?')) return;
                                navigate(isEdit ? `/roles/${id}` : '/roles');
                            }}
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            {busy ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {confirmImpact && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
                    <div className="w-full max-w-md card-panel p-6">
                        <h3 className="text-lg font-semibold">Permission change impact</h3>
                        <p className="mt-2 text-sm text-ink/60">
                            This role is assigned to {roleMeta?.users_count || 0} users. These access changes will affect all of them.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold" onClick={() => setConfirmImpact(false)}>Cancel</button>
                            <button
                                type="button"
                                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
                                onClick={() => persist()}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
