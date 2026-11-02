import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../services/api.js';

const emptyForm = {
    employee_id: '', first_name: '', last_name: '', phone: '', email: '',
    designation: '', joining_date: new Date().toISOString().slice(0, 10),
    salary: 0, status: 'active', role_id: '', password: '',
};

export default function StaffPage() {
    const [rows, setRows] = useState([]);
    const [roles, setRoles] = useState([]);
    const [meta, setMeta] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(null);
    const [open, setOpen] = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);

    async function load(page = 1) {
        setLoading(true);
        try {
            const response = await api(`/staff?page=${page}&search=${encodeURIComponent(query)}`);
            setRows(response.data || []);
            setMeta(response.meta || null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        api('/role-options').then((response) => setRoles(response.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => load(1), 250);
        return () => clearTimeout(timer);
    }, [query]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setOpen(true);
    }

    function openEdit(row) {
        setEditing(row);
        setForm({
            employee_id: row.employee_id || '',
            first_name: row.first_name || '',
            last_name: row.last_name || '',
            phone: row.phone || '',
            email: row.email || '',
            designation: row.designation || '',
            joining_date: row.joining_date || '',
            salary: row.salary || 0,
            status: row.status || 'active',
            role_id: row.role_id || '',
            password: '',
        });
        setOpen(true);
    }

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        try {
            if (editing) {
                await api(`/staff/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
                toast.success('Employee updated');
            } else {
                await api('/staff', { method: 'POST', body: JSON.stringify(form) });
                toast.success('Employee created');
            }
            setOpen(false);
            load(meta?.current_page || 1);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function disableEmployee() {
        setBusy(true);
        try {
            await api(`/staff/${confirmId}`, { method: 'DELETE' });
            toast.success('Employee disabled');
            setConfirmId(null);
            load(meta?.current_page || 1);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Employees"
                description="Manage restaurant staff accounts and employment status."
                breadcrumbs={['Staff', 'Employees']}
                actions={(
                    <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                        <Plus size={16} /> Add employee
                    </button>
                )}
            />

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3">
                <Search size={16} className="text-ink/35" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, phone, email, employee ID…"
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
            </div>

            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No employees yet."
                columns={[
                    { key: 'employee_id', label: 'ID' },
                    { key: 'name', label: 'Name', render: (row) => `${row.first_name} ${row.last_name}` },
                    { key: 'phone', label: 'Phone' },
                    { key: 'designation', label: 'Designation', render: (row) => row.designation || '—' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => openEdit(row)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink/5">Edit</button>
                                <button type="button" onClick={() => setConfirmId(row.id)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-coral hover:bg-coral/5">Disable</button>
                            </div>
                        ),
                    },
                ]}
            />

            <Pagination meta={meta} onPage={load} />

            <FormModal
                open={open}
                title={editing ? 'Edit employee' : 'Add employee'}
                onClose={() => setOpen(false)}
                onSubmit={save}
                busy={busy}
                wide
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Employee ID" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} required />
                    <Input label="Designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} />
                    <Input label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
                    <Input label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
                    <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
                    <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                    <Input label="Joining date" type="date" value={form.joining_date} onChange={(v) => setForm({ ...form, joining_date: v })} required />
                    <Input label="Salary" type="number" value={form.salary} onChange={(v) => setForm({ ...form, salary: v })} />
                    <label className="block text-sm sm:col-span-2">
                        <span className="mb-2 block font-medium">Role</span>
                        <select className="field" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                            <option value="">No login role</option>
                            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Status</span>
                        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                            <option value="terminated">Terminated</option>
                        </select>
                    </label>
                    <Input
                        label={editing ? 'New password (optional)' : 'Login password'}
                        type="password"
                        value={form.password}
                        onChange={(v) => setForm({ ...form, password: v })}
                        required={!editing && Boolean(form.role_id)}
                    />
                </div>
            </FormModal>

            <ConfirmDialog
                open={Boolean(confirmId)}
                title="Disable employee?"
                message="They will lose login access. Historical records stay intact."
                confirmLabel="Disable"
                busy={busy}
                onCancel={() => setConfirmId(null)}
                onConfirm={disableEmployee}
            />
        </div>
    );
}

function Input({ label, value, onChange, type = 'text', required = false }) {
    return (
        <label className="block text-sm">
            <span className="mb-2 block font-medium">{label}</span>
            <input className="field" type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}
