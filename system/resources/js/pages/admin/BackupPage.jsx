import { DatabaseBackup, Download, HardDriveDownload, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, apiUrl } from '../../services/api.js';

function formatBytes(bytes) {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupPage() {
    const { isSuperAdmin, can } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [includeStorage, setIncludeStorage] = useState(false);
    const [password, setPassword] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api('/admin/backups');
            setRows(response.data || []);
        } catch (error) {
            toast.error(error.message || 'Unable to load backups');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (!isSuperAdmin || !can('system.backup')) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                Only Super Admin can manage backups.
            </div>
        );
    }

    async function createBackup() {
        if (!password.trim()) {
            toast.error('Enter your password to create a backup.');
            return;
        }
        setBusy('create');
        try {
            await api('/admin/backups', {
                method: 'POST',
                body: JSON.stringify({ password, include_storage: includeStorage }),
            });
            toast.success('Backup created');
            setPassword('');
            await load();
        } catch (error) {
            toast.error(error.message || 'Backup failed');
        } finally {
            setBusy('');
        }
    }

    async function downloadBackup(name) {
        setBusy(`dl-${name}`);
        try {
            const token = localStorage.getItem('respos_token');
            const response = await fetch(apiUrl(`/admin/backups/${encodeURIComponent(name)}/download`), {
                headers: {
                    Accept: 'application/octet-stream',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(error.message || 'Download failed');
        } finally {
            setBusy('');
        }
    }

    async function confirmDelete() {
        if (!pendingDelete || !password.trim()) return;
        setBusy(`del-${pendingDelete}`);
        try {
            await api(`/admin/backups/${encodeURIComponent(pendingDelete)}`, {
                method: 'DELETE',
                body: JSON.stringify({ password }),
            });
            toast.success('Backup deleted');
            setPendingDelete(null);
            setPassword('');
            await load();
        } catch (error) {
            toast.error(error.message || 'Delete failed');
        } finally {
            setBusy('');
        }
    }

    return (
        <div>
            <PageHeader
                title="Backups"
                description="Create and download database backups. Super Admin only."
                breadcrumbs={['System Administration', 'Backups']}
            />

            <section className="mb-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-herb/10 text-herb"><DatabaseBackup size={22} /></span>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold">Create backup</h2>
                        <p className="mt-1 text-sm text-ink/50">Exports the live database to `storage/app/backups`. Optionally include public uploads.</p>
                        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink/70">
                            <input type="checkbox" checked={includeStorage} onChange={(e) => setIncludeStorage(e.target.checked)} />
                            Include public storage files (zip)
                        </label>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Confirm your password"
                                className="field max-w-xs"
                            />
                            <button type="button" disabled={Boolean(busy)} onClick={createBackup} className="btn-primary inline-flex items-center gap-2">
                                <HardDriveDownload size={18} /> {busy === 'create' ? 'Creating…' : 'Create backup'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
                <div className="border-b border-ink/8 px-5 py-3 text-sm font-semibold">Existing backups</div>
                {loading ? (
                    <p className="p-5 text-sm text-ink/45">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="p-5 text-sm text-ink/45">No backups yet.</p>
                ) : (
                    <ul className="divide-y divide-ink/8">
                        {rows.map((row) => (
                            <li key={row.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                <div>
                                    <p className="font-semibold">{row.name}</p>
                                    <p className="text-xs text-ink/45">{formatBytes(row.size)} · {new Date(row.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold" onClick={() => downloadBackup(row.name)}>
                                        <Download size={16} /> Download
                                    </button>
                                    <button type="button" disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600" onClick={() => { setPendingDelete(row.name); setPassword(''); }}>
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {pendingDelete && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setPendingDelete(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">Delete backup?</h3>
                        <p className="mt-2 text-sm text-ink/55">{pendingDelete}</p>
                        <input type="password" className="field mt-4" placeholder="Confirm your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button type="button" className="rounded-xl border border-ink/10 py-2.5 text-sm font-semibold" onClick={() => setPendingDelete(null)}>Cancel</button>
                            <button type="button" className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
