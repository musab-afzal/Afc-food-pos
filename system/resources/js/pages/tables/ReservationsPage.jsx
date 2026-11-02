import { Edit3, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { formatDate } from '../../utils/format.js';

const statuses = ['pending', 'confirmed', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'];
const emptyForm = {
    guest_name: '', phone: '', guests: 2, reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: '19:00', restaurant_table_id: '', area_id: '', special_request: '', status: 'pending', customer_id: '',
};

export default function ReservationsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', status: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/reservations', filters);
    const [tables, setTables] = useState([]);
    const [areas, setAreas] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        Promise.all([
            api('/tables?per_page=100&is_active=1'),
            api('/areas?per_page=100'),
        ]).then(([t, a]) => {
            setTables(t.data || []);
            setAreas(a.data || []);
        }).catch(() => {});
    }, []);

    function openForm(row = null) {
        setEditing(row);
        setForm(row ? {
            guest_name: row.guest_name,
            phone: row.phone || '',
            guests: row.guests,
            reservation_date: String(row.reservation_date).slice(0, 10),
            reservation_time: String(row.reservation_time).slice(0, 5),
            restaurant_table_id: row.restaurant_table_id || '',
            area_id: row.area_id || '',
            special_request: row.special_request || '',
            status: row.status,
            customer_id: row.customer_id || '',
        } : emptyForm);
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const payload = {
                ...form,
                restaurant_table_id: form.restaurant_table_id || null,
                area_id: form.area_id || null,
                customer_id: form.customer_id || null,
                special_request: form.special_request || null,
            };
            await api(editing ? `/reservations/${editing.id}` : '/reservations', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            toast.success(editing ? 'Reservation updated' : 'Reservation created');
            setOpen(false);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function setStatus(row, status) {
        try {
            await api(`/reservations/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
            toast.success(`Status → ${status}`);
            reload();
        } catch (error) {
            toast.error(error.message);
        }
    }

    return (
        <div>
            <PageHeader
                title="Reservations"
                description="Bookings with conflict-aware table assignment."
                breadcrumbs={['Tables', 'Reservations']}
                actions={can('tables.reservations') && (
                    <button type="button" onClick={() => openForm()} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> New reservation
                    </button>
                )}
            />
            <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1"><SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Search guest or phone…" /></div>
                <select className="field max-w-[180px]" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No reservations yet."
                columns={[
                    { key: 'guest_name', label: 'Guest', render: (row) => <div><p className="font-semibold">{row.guest_name}</p><p className="text-xs text-ink/40">{row.phone || '—'}</p></div> },
                    { key: 'when', label: 'When', render: (row) => `${formatDate(row.reservation_date)} ${String(row.reservation_time).slice(0, 5)}` },
                    { key: 'guests', label: 'Guests' },
                    { key: 'table', label: 'Table', render: (row) => row.table?.name || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('tables.reservations') && (
                            <div className="flex justify-end gap-1">
                                <select className="rounded-lg border border-ink/10 bg-white px-2 py-1 text-xs" value={row.status} onChange={(e) => setStatus(row, e.target.value)}>
                                    {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                </select>
                                <button type="button" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-ink/5"><Edit3 size={16} /></button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
            <FormModal open={open} title={editing ? 'Edit reservation' : 'New reservation'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} wide>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm"><span className="mb-2 block font-medium">Guest name</span><input className="field" required value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Phone</span><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Guests</span><input className="field" type="number" min="1" required value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Status</span>
                        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Date</span><input className="field" type="date" required value={form.reservation_date} onChange={(e) => setForm({ ...form, reservation_date: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Time</span><input className="field" type="time" required value={form.reservation_time} onChange={(e) => setForm({ ...form, reservation_time: e.target.value })} /></label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Area</span>
                        <select className="field" value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })}>
                            <option value="">Any</option>
                            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm"><span className="mb-2 block font-medium">Table</span>
                        <select className="field" value={form.restaurant_table_id} onChange={(e) => setForm({ ...form, restaurant_table_id: e.target.value })}>
                            <option value="">Unassigned</option>
                            {tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-medium">Special request</span><textarea className="field min-h-20" value={form.special_request} onChange={(e) => setForm({ ...form, special_request: e.target.value })} /></label>
                </div>
            </FormModal>
        </div>
    );
}
