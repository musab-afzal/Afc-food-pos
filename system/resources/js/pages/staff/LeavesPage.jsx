import { Check, Plus, X } from 'lucide-react';
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
import { formatDate } from '../../utils/format.js';

const empty = {
    staff_id: '',
    leave_type: 'annual',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
};

export default function LeavesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ status: 'pending', staff_id: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/leaves', filters);
    const [staff, setStaff] = useState([]);
    const [open, setOpen] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(empty);

    useEffect(() => {
        api('/staff?per_page=100&status=active').then((r) => setStaff(r.data || [])).catch(() => {});
    }, []);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/leaves', {
                method: 'POST',
                body: JSON.stringify({
                    staff_id: Number(form.staff_id),
                    leave_type: form.leave_type,
                    start_date: form.start_date,
                    end_date: form.end_date,
                    reason: form.reason || null,
                }),
            });
            toast.success('Leave requested');
            setOpen(false);
            setForm(empty);
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function decide(row, action) {
        setBusyId(row.id);
        try {
            await api(`/leaves/${row.id}/${action}`, { method: 'POST', body: '{}' });
            toast.success(action === 'approve' ? 'Leave approved' : 'Leave rejected');
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div>
            <PageHeader
                title="Leaves"
                description="Requests, approvals, and coverage."
                breadcrumbs={['Staff', 'Leaves']}
                actions={(can('attendance.manage') || can('staff.edit')) && (
                    <button type="button" onClick={() => { setForm(empty); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Request leave
                    </button>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.staff_id} onChange={(e) => setFilters((f) => ({ ...f, staff_id: e.target.value, page: 1 }))}>
                    <option value="">All staff</option>
                    {staff.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No leave requests."
                rows={rows}
                columns={[
                    { key: 'staff', label: 'Employee', render: (row) => row.staff ? `${row.staff.first_name} ${row.staff.last_name}` : '—' },
                    { key: 'leave_type', label: 'Type', render: (row) => <span className="capitalize">{row.leave_type}</span> },
                    { key: 'range', label: 'Dates', render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.end_date)}` },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'reason', label: 'Reason', render: (row) => row.reason || '—' },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => row.status === 'pending' && can('attendance.approve') && (
                            <div className="flex justify-end gap-2">
                                <button type="button" disabled={busyId === row.id} onClick={() => decide(row, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-herb/15 px-2.5 py-1 text-xs font-semibold text-herb disabled:opacity-40">
                                    <Check size={14} /> Approve
                                </button>
                                <button type="button" disabled={busyId === row.id} onClick={() => decide(row, 'reject')} className="inline-flex items-center gap-1 rounded-lg bg-coral/15 px-2.5 py-1 text-xs font-semibold text-coral disabled:opacity-40">
                                    <X size={14} /> Reject
                                </button>
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={open} title="Request leave" onClose={() => setOpen(false)} onSubmit={submit} busy={busy} submitLabel="Submit">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Employee
                        <select required className="field mt-1" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                            <option value="">Select…</option>
                            {staff.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-medium">Type
                        <select className="field mt-1" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                            <option value="annual">Annual</option>
                            <option value="sick">Sick</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="emergency">Emergency</option>
                        </select>
                    </label>
                    <div />
                    <label className="text-sm font-medium">Start
                        <input required type="date" className="field mt-1" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium">End
                        <input required type="date" className="field mt-1" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">Reason
                        <textarea className="field mt-1 min-h-24" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                    </label>
                </div>
            </FormModal>
        </div>
    );
}
