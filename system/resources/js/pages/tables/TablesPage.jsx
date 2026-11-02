import { Edit3, Plus, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
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

const emptyForm = {
    area_id: '', name: '', table_number: '', capacity: 4, shape: 'square',
    status: 'available', sort_order: 0, is_active: true,
};

export default function TablesPage() {
    const { can } = useAuth();
    const [areas, setAreas] = useState([]);
    const [filters, setFilters] = useState({ search: '', area_id: '', status: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/tables', filters);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleting, setDeleting] = useState(null);
    const [qrInfo, setQrInfo] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/areas?per_page=100').then((r) => setAreas(r.data || [])).catch(() => {});
    }, []);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            area_id: row.area_id || '',
            name: row.name,
            table_number: row.table_number || '',
            capacity: row.capacity,
            shape: row.shape || 'square',
            status: row.status,
            sort_order: row.sort_order ?? 0,
            is_active: row.is_active,
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api(editing ? `/tables/${editing.id}` : '/tables', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...form,
                    area_id: form.area_id || null,
                    table_number: form.table_number || null,
                }),
            });
            toast.success(editing ? 'Table updated' : 'Table created');
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
            await api(`/tables/${deleting.id}`, { method: 'DELETE' });
            toast.success('Table archived');
            setDeleting(null);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function showQr(row) {
        try {
            const response = await api(`/tables/${row.id}/qr`);
            setQrInfo(response.data);
        } catch (error) {
            toast.error(error.message);
        }
    }

    async function changeStatus(row, status) {
        try {
            await api(`/tables/${row.id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
            toast.success(`Marked ${status}`);
            reload();
        } catch (error) {
            toast.error(error.message);
        }
    }

    return (
        <div>
            <PageHeader
                title="Tables"
                description="Manage dining tables, capacity, and service status."
                breadcrumbs={['Tables', 'List']}
                actions={can('tables.manage') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add table
                    </button>
                )}
            />
            <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1"><SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search tables…" /></div>
                <select className="field max-w-[180px]" value={filters.area_id} onChange={(e) => setFilters((f) => ({ ...f, area_id: e.target.value, page: 1 }))}>
                    <option value="">All areas</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
                <select className="field max-w-[160px]" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    {['available', 'occupied', 'reserved', 'cleaning', 'disabled'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No tables found."
                columns={[
                    { key: 'name', label: 'Table', render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink/40">#{row.table_number || row.id}</p></div> },
                    { key: 'area', label: 'Area', render: (row) => row.area?.name || '—' },
                    { key: 'capacity', label: 'Seats' },
                    { key: 'shape', label: 'Shape', render: (row) => <span className="capitalize">{row.shape}</span> },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => showQr(row)} className="rounded-lg p-2 hover:bg-ink/5" title="QR"><QrCode size={16} /></button>
                                {can('tables.manage') && (
                                    <>
                                        <select className="rounded-lg border border-ink/10 bg-white px-2 py-1 text-xs" value={row.status} onChange={(e) => changeStatus(row, e.target.value)}>
                                            {['available', 'occupied', 'reserved', 'cleaning', 'disabled'].map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                                        <button type="button" onClick={() => setDeleting(row)} className="rounded-lg px-3 py-1.5 text-sm text-coral hover:bg-coral/5">Archive</button>
                                    </>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit table' : 'Add table'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Name</span><input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Number</span><input className="field" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Area</span>
                        <select className="field" value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })}>
                            <option value="">Unassigned</option>
                            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Capacity</span><input className="field" type="number" min="1" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Shape</span>
                        <select className="field" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value })}>
                            {['square', 'round', 'rectangle'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Status</span>
                        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {['available', 'occupied', 'reserved', 'cleaning', 'disabled'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                </div>
            </FormModal>
            <ConfirmDialog open={Boolean(deleting)} title="Archive table?" message="Historical orders keep their table reference." confirmLabel="Archive" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />
            {qrInfo && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4" onClick={() => setQrInfo(null)}>
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 soft-shadow" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">Table QR</h3>
                        <p className="mt-2 text-sm text-ink/55">Token: <code className="rounded bg-cream px-2 py-1 text-xs">{qrInfo.qr_token}</code></p>
                        <p className="mt-3 break-all rounded-xl bg-cream px-4 py-3 text-sm">{qrInfo.url || qrInfo.path}</p>
                        <button type="button" className="mt-5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setQrInfo(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
