import { Plus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const empty = { name: '', start_time: '09:00', end_time: '17:00', grace_minutes: 15, is_active: true };

function timeLabel(value) {
    if (!value) return '—';
    return String(value).slice(0, 5);
}

export default function ShiftsPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', is_active: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/shifts', filters);
    const [staff, setStaff] = useState([]);
    const [open, setOpen] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);
    const [staffId, setStaffId] = useState('');

    useEffect(() => {
        api('/staff?per_page=100&status=active').then((r) => setStaff(r.data || [])).catch(() => {});
    }, []);

    function openCreate() {
        setEditing(null);
        setForm(empty);
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            name: row.name,
            start_time: timeLabel(row.start_time),
            end_time: timeLabel(row.end_time),
            grace_minutes: row.grace_minutes ?? 15,
            is_active: Boolean(row.is_active),
        });
        setOpen(true);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const path = editing ? `/shifts/${editing.id}` : '/shifts';
            await api(path, {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name: form.name,
                    start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
                    end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
                    grace_minutes: Number(form.grace_minutes),
                    is_active: Boolean(form.is_active),
                }),
            });
            toast.success(editing ? 'Shift updated' : 'Shift created');
            setOpen(false);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function assign(event) {
        event.preventDefault();
        if (!assigning) return;
        setBusy(true);
        try {
            await api(`/shifts/${assigning.id}/assign`, {
                method: 'POST',
                body: JSON.stringify({ staff_id: Number(staffId) }),
            });
            toast.success('Staff assigned');
            setAssigning(null);
            setStaffId('');
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Shifts"
                description="Define working windows and assign employees."
                breadcrumbs={['Staff', 'Shifts']}
                actions={can('staff.edit') && (
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> New shift
                    </button>
                )}
            />

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No shifts yet."
                rows={rows}
                columns={[
                    { key: 'name', label: 'Shift', render: (row) => <span className="font-semibold">{row.name}</span> },
                    { key: 'hours', label: 'Hours', render: (row) => `${timeLabel(row.start_time)} – ${timeLabel(row.end_time)}` },
                    { key: 'grace_minutes', label: 'Grace', render: (row) => `${row.grace_minutes} min` },
                    { key: 'staff_count', label: 'Assigned', render: (row) => row.staff_count ?? row.staff?.length ?? 0 },
                    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => can('staff.edit') && (
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => { setAssigning(row); setStaffId(''); }} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                    <UserPlus size={14} /> Assign
                                </button>
                                <button type="button" onClick={() => openEdit(row)} className="text-sm font-semibold text-ink/60">Edit</button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title={editing ? 'Edit shift' : 'Create shift'} onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel={editing ? 'Update' : 'Create'}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Name
                        <input required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Start
                        <input required type="time" className="field mt-1" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">End
                        <input required type="time" className="field mt-1" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">Grace (minutes)
                        <input required type="number" min="0" className="field mt-1" value={form.grace_minutes} onChange={(e) => setForm({ ...form, grace_minutes: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 self-end text-sm font-medium">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                </div>
            </FormModal>

            <FormModal open={Boolean(assigning)} title={`Assign to ${assigning?.name || ''}`} onClose={() => setAssigning(null)} onSubmit={assign} busy={busy} submitLabel="Assign">
                <label className="text-sm font-medium">Employee
                    <select required className="field mt-1" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                        <option value="">Select…</option>
                        {staff.map((person) => (
                            <option key={person.id} value={person.id}>{person.first_name} {person.last_name} ({person.employee_id})</option>
                        ))}
                    </select>
                </label>
            </FormModal>
        </div>
    );
}
