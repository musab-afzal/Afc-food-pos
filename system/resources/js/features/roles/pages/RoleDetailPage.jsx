import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../../components/PageHeader.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import { roleApi } from '../services/roleApi.js';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'users', label: 'Users' },
    { key: 'activity', label: 'Activity' },
];

export default function RoleDetailPage() {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') || 'overview';
    const [role, setRole] = useState(null);
    const [users, setUsers] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const roleRes = await roleApi.get(id);
                setRole(roleRes.data);
                if (tab === 'users') {
                    const usersRes = await roleApi.users(id);
                    setUsers(usersRes.data || []);
                }
                if (tab === 'activity') {
                    const activityRes = await roleApi.activity(id);
                    setActivity(activityRes.data || []);
                }
            } catch (error) {
                toast.error(error.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, tab]);

    if (loading && !role) {
        return <div className="h-64 animate-pulse rounded-3xl bg-white" />;
    }

    if (!role) {
        return <p className="text-sm text-ink/50">Role not found.</p>;
    }

    const grouped = (role.permissions || []).reduce((acc, permission) => {
        const module = permission.module || 'General';
        acc[module] = acc[module] || [];
        acc[module].push(permission);
        return acc;
    }, {});

    return (
        <div>
            <PageHeader
                title={role.name}
                description={role.description || 'Role details and assigned access.'}
                breadcrumbs={['System Administration', 'Roles', role.name]}
                actions={(
                    <div className="flex gap-2">
                        <Link to="/roles" className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold">Back</Link>
                        <Link to={`/roles/${role.id}/edit`} className="btn-primary">Edit Permissions</Link>
                    </div>
                )}
            />

            <div className="mb-5 flex flex-wrap gap-2">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setSearchParams(item.key === 'overview' ? {} : { tab: item.key })}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === item.key ? 'bg-ink text-white' : 'bg-white text-ink/60 soft-shadow'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Type', role.is_system ? 'System Role' : 'Custom Role'],
                        ['Status', role.is_active ? 'Active' : 'Inactive'],
                        ['Permissions', role.permissions?.length || 0],
                        ['Assigned Users', role.users_count ?? 0],
                        ['Created', role.created_at ? new Date(role.created_at).toLocaleString() : '—'],
                        ['Updated', role.updated_at ? new Date(role.updated_at).toLocaleString() : '—'],
                        ['Max discount', `${role.max_discount_percent}%`],
                        ['Slug', role.slug],
                    ].map(([label, value]) => (
                        <article key={label} className="card-panel p-5">
                            <p className="text-xs uppercase tracking-[.16em] text-ink/35">{label}</p>
                            <p className="mt-2 text-lg font-semibold">{value}</p>
                        </article>
                    ))}
                    {role.slug === 'super_admin' && (
                        <article className="rounded-3xl bg-coral/10 p-5 md:col-span-2">
                            <p className="text-sm font-semibold text-coral">SYSTEM PROTECTED</p>
                            <p className="mt-1 text-sm text-ink/65">Super Admin has unrestricted system access.</p>
                        </article>
                    )}
                </div>
            )}

            {tab === 'permissions' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(grouped).map(([module, items]) => (
                        <article key={module} className="card-panel p-5">
                            <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">{module}</p>
                            <ul className="mt-3 space-y-1.5">
                                {items.map((permission) => (
                                    <li key={permission.id} className="text-sm">
                                        <span className="font-medium">{permission.name}</span>
                                        <span className="ml-2 text-xs text-ink/35">{permission.slug}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                    {Object.keys(grouped).length === 0 && (
                        <p className="text-sm text-ink/50">No permissions assigned.</p>
                    )}
                </div>
            )}

            {tab === 'users' && (
                <div className="overflow-hidden card-panel">
                    <table className="min-w-full text-sm">
                        <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-ink/45">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Employee ID</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-t border-ink/5">
                                    <td className="px-4 py-3 font-medium">{user.name}</td>
                                    <td className="px-4 py-3">{user.employee_id || '—'}</td>
                                    <td className="px-4 py-3">{user.email}</td>
                                    <td className="px-4 py-3"><StatusBadge status={user.status || (user.is_active ? 'active' : 'inactive')} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <Link to="/user-access" className="text-xs font-semibold text-herb">Change Role</Link>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/45">No users assigned to this role.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'activity' && (
                <div className="space-y-3">
                    {activity.map((log) => (
                        <article key={log.id} className="rounded-2xl bg-white px-4 py-3 soft-shadow">
                            <p className="text-sm font-medium">
                                {log.actor || 'System'} · {log.action.replaceAll('.', ' ')}
                            </p>
                            <p className="mt-1 text-xs text-ink/40">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                            </p>
                        </article>
                    ))}
                    {activity.length === 0 && (
                        <p className="rounded-3xl bg-white p-8 text-center text-sm text-ink/45 soft-shadow">No role activity logged yet.</p>
                    )}
                </div>
            )}
        </div>
    );
}
