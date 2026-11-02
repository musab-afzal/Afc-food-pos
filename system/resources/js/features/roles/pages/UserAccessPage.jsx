import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../../components/DataTable.jsx';
import FormModal from '../../../components/FormModal.jsx';
import PageHeader from '../../../components/PageHeader.jsx';
import SearchInput from '../../../components/SearchInput.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { api } from '../../../services/api.js';
import { roleApi } from '../services/roleApi.js';

const emptyUserForm = {
    employee_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    designation: '',
    joining_date: new Date().toISOString().slice(0, 10),
    salary: 0,
    status: 'active',
    role_id: '',
    password: '',
};

export default function UserAccessPage() {
    const { refreshUser, user: authUser } = useAuth();
    const [rows, setRows] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [assignTarget, setAssignTarget] = useState(null);
    const [newRoleId, setNewRoleId] = useState('');
    const [busy, setBusy] = useState(false);
    const [effective, setEffective] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(emptyUserForm);
    const [addBusy, setAddBusy] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ per_page: '50' });
            if (query.trim()) params.set('search', query.trim());
            if (roleFilter) params.set('role_id', roleFilter);
            if (statusFilter) params.set('status', statusFilter);
            const [accessRes, rolesRes] = await Promise.all([
                roleApi.userAccess(params.toString()),
                roleApi.list('per_page=100'),
            ]);
            setRows(accessRes.data || []);
            setRoles(rolesRes.data || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [roleFilter, statusFilter]);
    useEffect(() => {
        const timer = setTimeout(() => load(), 250);
        return () => clearTimeout(timer);
    }, [query]);

    function openAssign(row) {
        setAssignTarget(row);
        setNewRoleId(String(row.role?.id || ''));
    }

    async function saveRole(event) {
        event.preventDefault();
        const role = roles.find((r) => String(r.id) === String(newRoleId));
        if (!role) {
            toast.error('Select a role');
            return;
        }
        if (role.slug === 'super_admin') {
            const ok = window.confirm('You are granting unrestricted system access to this user. Continue?');
            if (!ok) return;
        }
        setBusy(true);
        try {
            await roleApi.assignRole(assignTarget.id, {
                role_id: Number(newRoleId),
                confirm_super_admin: role.slug === 'super_admin',
            });
            toast.success('User role updated');
            setAssignTarget(null);
            await load();
            if (authUser?.id === assignTarget.id) {
                await refreshUser();
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function viewEffective(row) {
        try {
            const response = await roleApi.effectivePermissions(row.id);
            setEffective(response.data);
        } catch (error) {
            toast.error(error.message);
        }
    }

    function openAddUser() {
        const nextId = `EMP-${String(Date.now()).slice(-6)}`;
        setAddForm({ ...emptyUserForm, employee_id: nextId });
        setAddOpen(true);
    }

    async function saveNewUser(event) {
        event.preventDefault();
        if (!addForm.email?.trim()) {
            toast.error('Email is required for login access.');
            return;
        }
        if (!addForm.role_id) {
            toast.error('Select a role.');
            return;
        }
        if (!addForm.password || addForm.password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }

        const role = roles.find((r) => String(r.id) === String(addForm.role_id));
        if (role?.slug === 'super_admin') {
            const ok = window.confirm('You are granting unrestricted system access to this user. Continue?');
            if (!ok) return;
        }

        setAddBusy(true);
        try {
            await api('/staff', {
                method: 'POST',
                body: JSON.stringify({
                    ...addForm,
                    role_id: Number(addForm.role_id),
                    salary: Number(addForm.salary) || 0,
                }),
            });
            toast.success('User created and role assigned');
            setAddOpen(false);
            setAddForm(emptyUserForm);
            await load();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setAddBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="User Access"
                description="Create users, assign roles, and review effective permissions."
                breadcrumbs={['System Administration', 'User Access']}
                actions={(
                    <button type="button" onClick={openAddUser} className="flex items-center gap-2 btn-primary">
                        <Plus size={16} /> Add User
                    </button>
                )}
            />

            <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_160px]">
                <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, employee ID…" />
                <select className="field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="">All roles</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No users found."
                columns={[
                    {
                        key: 'user',
                        label: 'User',
                        render: (row) => (
                            <div>
                                <p className="font-semibold">{row.name}</p>
                                {row.is_super_admin && <span className="text-[10px] font-bold uppercase tracking-wide text-coral">Super Admin</span>}
                            </div>
                        ),
                    },
                    { key: 'employee_id', label: 'Employee ID', render: (row) => row.employee_id || '—' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Current Role', render: (row) => row.role?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || (row.is_active ? 'active' : 'inactive')} /> },
                    {
                        key: 'last_login_at',
                        label: 'Last Login',
                        render: (row) => row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '—',
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-2">
                                <button type="button" className="rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-ink/5" onClick={() => openAssign(row)}>
                                    Change Role
                                </button>
                                <button type="button" className="rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-ink/5" onClick={() => viewEffective(row)}>
                                    Effective Permissions
                                </button>
                            </div>
                        ),
                    },
                ]}
            />

            <FormModal
                open={addOpen}
                title="Add User"
                description="Create a login user and assign a role."
                onClose={() => setAddOpen(false)}
                onSubmit={saveNewUser}
                busy={addBusy}
                submitLabel="Create User"
                wide
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Employee ID *</span>
                        <input className="field" required value={addForm.employee_id} onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Designation</span>
                        <input className="field" value={addForm.designation} onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">First name *</span>
                        <input className="field" required value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Last name *</span>
                        <input className="field" required value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Phone *</span>
                        <input className="field" required value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Email *</span>
                        <input className="field" type="email" required value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Joining date *</span>
                        <input className="field" type="date" required value={addForm.joining_date} onChange={(e) => setAddForm({ ...addForm, joining_date: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Status</span>
                        <select className="field" value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Role *</span>
                        <select className="field" required value={addForm.role_id} onChange={(e) => setAddForm({ ...addForm, role_id: e.target.value })}>
                            <option value="">Select role…</option>
                            {roles.filter((r) => r.is_active).map((role) => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Login password *</span>
                        <input className="field" type="password" required minLength={8} value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
                    </label>
                </div>
            </FormModal>

            <FormModal
                open={Boolean(assignTarget)}
                title="Change Role"
                onClose={() => setAssignTarget(null)}
                onSubmit={saveRole}
                busy={busy}
                submitLabel="Save"
            >
                <div className="space-y-3 text-sm">
                    <p><span className="text-ink/45">User:</span> <strong>{assignTarget?.name}</strong></p>
                    <p><span className="text-ink/45">Current Role:</span> {assignTarget?.role?.name || '—'}</p>
                    <label className="block">
                        <span className="mb-2 block font-medium">New Role</span>
                        <select className="field" required value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}>
                            <option value="">Select role…</option>
                            {roles.filter((r) => r.is_active).map((role) => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </FormModal>

            {effective && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
                    <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto card-panel p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">{effective.user?.name}</h3>
                                <p className="text-sm text-ink/50">Role: {(effective.roles || []).join(', ') || '—'}</p>
                                {effective.is_super_admin && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-coral">Unrestricted Super Admin access</p>}
                            </div>
                            <button type="button" className="rounded-lg px-3 py-1.5 text-sm hover:bg-ink/5" onClick={() => setEffective(null)}>Close</button>
                        </div>
                        <div className="mt-5 space-y-4">
                            {Object.entries(effective.grouped || {}).map(([module, items]) => (
                                <div key={module}>
                                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">{module}</p>
                                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                        {items.map((permission) => (
                                            <li key={permission.id || permission.slug} className="text-sm">✓ {permission.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
