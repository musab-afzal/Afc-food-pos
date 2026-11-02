import { LogIn, LogOut } from 'lucide-react';
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
import { formatDate, formatDateTime } from '../../utils/format.js';

export default function AttendancePage() {
    const { can } = useAuth();
    const today = new Date().toISOString().slice(0, 10);
    const [filters, setFilters] = useState({ from: today, to: today, staff_id: '', status: '', page: 1, per_page: 20 });
    const { rows, meta, loading, reload, error } = usePaginatedResource('/attendance', filters);
    const [staff, setStaff] = useState([]);
    const [summary, setSummary] = useState(null);
    const [clockOpen, setClockOpen] = useState(null);
    const [busy, setBusy] = useState(false);
    const [clockForm, setClockForm] = useState({ staff_id: '', at: '' });

    useEffect(() => {
        api('/staff?per_page=100&status=active').then((r) => setStaff(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        api(`/staff-ops/dashboard?date=${filters.from || today}`)
            .then((r) => setSummary(r.data))
            .catch(() => setSummary(null));
    }, [filters.from, today]);

    async function clock(event) {
        event.preventDefault();
        if (!clockOpen) return;
        setBusy(true);
        try {
            await api(`/attendance/${clockOpen}`, {
                method: 'POST',
                body: JSON.stringify({
                    staff_id: clockForm.staff_id ? Number(clockForm.staff_id) : undefined,
                    at: clockForm.at || undefined,
                }),
            });
            toast.success(clockOpen === 'check-in' ? 'Checked in' : 'Checked out');
            setClockOpen(null);
            reload();
            api(`/staff-ops/dashboard?date=${filters.from || today}`).then((r) => setSummary(r.data)).catch(() => {});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    function minutesLabel(value) {
        const n = Number(value || 0);
        if (!n) return '—';
        const h = Math.floor(n / 60);
        const m = n % 60;
        return h ? `${h}h ${m}m` : `${m}m`;
    }

    return (
        <div>
            <PageHeader
                title="Attendance"
                description="Daily check-ins, lateness, and overtime."
                breadcrumbs={['Staff', 'Attendance']}
                actions={can('attendance.manage') && (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setClockOpen('check-in'); setClockForm({ staff_id: '', at: '' }); }} className="inline-flex items-center gap-2 rounded-xl bg-herb/15 px-4 py-2.5 text-sm font-semibold text-herb">
                            <LogIn size={16} /> Check in
                        </button>
                        <button type="button" onClick={() => { setClockOpen('check-out'); setClockForm({ staff_id: '', at: '' }); }} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                            <LogOut size={16} /> Check out
                        </button>
                    </div>
                )}
            />

            {summary && (
                <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Present', summary.counts?.present ?? summary.present ?? 0],
                        ['Late', summary.counts?.late ?? summary.late ?? 0],
                        ['Absent', summary.counts?.absent ?? summary.absent ?? 0],
                        ['On leave', summary.counts?.on_leave ?? summary.on_leave ?? 0],
                    ].map(([label, value]) => (
                        <article key={label} className="rounded-3xl bg-white p-5 soft-shadow">
                            <p className="text-xs uppercase tracking-wider text-ink/40">{label}</p>
                            <p className="mt-2 text-3xl font-semibold">{value}</p>
                        </article>
                    ))}
                </section>
            )}

            <div className="mb-4 flex flex-wrap gap-3">
                <input type="date" className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))} />
                <input type="date" className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))} />
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.staff_id} onChange={(e) => setFilters((f) => ({ ...f, staff_id: e.target.value, page: 1 }))}>
                    <option value="">All staff</option>
                    {staff.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}
                </select>
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                </select>
            </div>

            {error && <button type="button" onClick={reload} className="mb-4 w-full rounded-xl bg-coral/15 px-4 py-3 text-left text-sm text-coral">{error} — tap to retry</button>}

            <DataTable
                loading={loading}
                emptyMessage="No attendance rows for this filter."
                rows={rows}
                columns={[
                    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                    { key: 'staff', label: 'Employee', render: (row) => row.staff ? `${row.staff.first_name} ${row.staff.last_name}` : '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'check_in', label: 'In', render: (row) => formatDateTime(row.check_in) },
                    { key: 'check_out', label: 'Out', render: (row) => formatDateTime(row.check_out) },
                    { key: 'working_minutes', label: 'Worked', render: (row) => minutesLabel(row.working_minutes) },
                    { key: 'late_minutes', label: 'Late', render: (row) => minutesLabel(row.late_minutes) },
                    { key: 'overtime_minutes', label: 'OT', render: (row) => minutesLabel(row.overtime_minutes) },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={Boolean(clockOpen)} title={clockOpen === 'check-in' ? 'Check in' : 'Check out'} description="Leave employee blank to clock yourself if linked to a staff profile." onClose={() => setClockOpen(null)} onSubmit={clock} busy={busy} submitLabel="Submit">
                <label className="text-sm font-medium">Employee
                    <select className="field mt-1" value={clockForm.staff_id} onChange={(e) => setClockForm({ ...clockForm, staff_id: e.target.value })}>
                        <option value="">Me / default</option>
                        {staff.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}
                    </select>
                </label>
                <label className="mt-4 block text-sm font-medium">Time (optional)
                    <input type="datetime-local" className="field mt-1" value={clockForm.at} onChange={(e) => setClockForm({ ...clockForm, at: e.target.value })} />
                </label>
            </FormModal>
        </div>
    );
}
