import { MinusCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

function currentMonth() {
    return new Date().toISOString().slice(0, 7);
}

const emptyDeduction = {
    staff_id: '',
    amount: '',
    meal_date: new Date().toISOString().slice(0, 10),
    description: 'Custom salary deduction',
    notes: '',
};

export default function StaffPayrollPage() {
    const { can } = useAuth();
    const [month, setMonth] = useState(currentMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [staffOptions, setStaffOptions] = useState([]);
    const [deductOpen, setDeductOpen] = useState(false);
    const [form, setForm] = useState(emptyDeduction);
    const [busy, setBusy] = useState(false);

    async function load(selectedMonth = month) {
        setLoading(true);
        try {
            const response = await api(`/staff/payroll?month=${encodeURIComponent(selectedMonth)}`);
            setData(response.data || null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(month);
    }, [month]);

    useEffect(() => {
        api('/staff?status=active&per_page=100')
            .then((response) => setStaffOptions(response.data || []))
            .catch(() => setStaffOptions([]));
    }, []);

    const employees = data?.employees || [];
    const totals = data?.totals || { salary: 0, meal_deductions: 0, net_pay: 0 };
    const title = useMemo(() => {
        if (!data?.month) return 'Staff payroll';
        const [year, mon] = data.month.split('-');
        const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
        return `Staff payroll — ${label}`;
    }, [data?.month]);

    function openDeduction(staffId = '') {
        setForm({
            ...emptyDeduction,
            staff_id: staffId ? String(staffId) : '',
            meal_date: new Date().toISOString().slice(0, 10),
        });
        setDeductOpen(true);
    }

    async function saveDeduction(event) {
        event.preventDefault();
        if (!form.staff_id) {
            toast.error('Select an employee.');
            return;
        }
        if (!Number(form.amount) || Number(form.amount) <= 0) {
            toast.error('Enter a valid amount.');
            return;
        }

        setBusy(true);
        try {
            await api('/staff-meals', {
                method: 'POST',
                body: JSON.stringify({
                    staff_id: Number(form.staff_id),
                    amount: Number(form.amount),
                    meal_date: form.meal_date || null,
                    description: form.description?.trim() || 'Custom salary deduction',
                    notes: form.notes?.trim() || null,
                }),
            });
            toast.success('Custom deduction saved');
            setDeductOpen(false);
            await load(month);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function removeDeduction(mealId) {
        if (!window.confirm('Remove this deduction from salary?')) return;
        setBusy(true);
        try {
            await api(`/staff-meals/${mealId}`, { method: 'DELETE' });
            toast.success('Deduction removed');
            await load(month);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    function printReport() {
        window.print();
    }

    return (
        <div>
            <div className="print:hidden">
                <PageHeader
                    title="Staff Payroll"
                    description="Monthly salary minus staff meals and custom deductions. Print the full detail at month end."
                    breadcrumbs={['Staff', 'Payroll']}
                    actions={(
                        <div className="flex flex-wrap gap-2">
                            {can('staff.edit') && (
                                <button type="button" onClick={() => openDeduction()} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-ink/5">
                                    <MinusCircle size={16} /> Add custom deduction
                                </button>
                            )}
                            <button type="button" onClick={printReport} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                                <Printer size={16} /> Print month report
                            </button>
                        </div>
                    )}
                />

                <div className="mb-5 flex flex-wrap items-end gap-3">
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Month</span>
                        <input className="field" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                    </label>
                    <button type="button" className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-medium hover:bg-ink/5" onClick={() => load(month)}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="hidden print:block mb-4">
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-sm text-ink/60">
                    Period {data?.period_start || '—'} to {data?.period_end || '—'}
                </p>
            </div>

            {loading ? (
                <p className="text-sm text-ink/50">Loading payroll…</p>
            ) : (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
                        <SummaryCard label="Gross salary" value={currency(totals.salary)} />
                        <SummaryCard label="Deductions" value={currency(totals.meal_deductions)} />
                        <SummaryCard label="Net pay" value={currency(totals.net_pay)} accent />
                    </div>

                    {employees.length === 0 && (
                        <p className="rounded-xl border border-ink/10 bg-white p-6 text-sm text-ink/50">No employees for this month.</p>
                    )}

                    {employees.map((employee) => (
                        <section key={employee.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-white print:break-inside-avoid">
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/5 px-5 py-4">
                                <div>
                                    <h2 className="text-lg font-semibold">{employee.name}</h2>
                                    <p className="text-sm text-ink/50">
                                        {employee.employee_id}
                                        {employee.designation ? ` · ${employee.designation}` : ''}
                                        {' · '}
                                        {employee.status}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-start gap-4">
                                    <div className="grid grid-cols-3 gap-4 text-right text-sm">
                                        <div>
                                            <p className="text-ink/45">Salary</p>
                                            <p className="font-semibold">{currency(employee.salary)}</p>
                                        </div>
                                        <div>
                                            <p className="text-ink/45">Deductions</p>
                                            <p className="font-semibold text-rose-700">−{currency(employee.meal_deductions)}</p>
                                        </div>
                                        <div>
                                            <p className="text-ink/45">Net</p>
                                            <p className="font-semibold text-emerald-700">{currency(employee.net_pay)}</p>
                                        </div>
                                    </div>
                                    {can('staff.edit') && (
                                        <button
                                            type="button"
                                            className="print:hidden rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5"
                                            onClick={() => openDeduction(employee.id)}
                                        >
                                            <span className="inline-flex items-center gap-1"><Plus size={14} /> Deduct</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {(employee.meals || []).length === 0 ? (
                                <p className="px-5 py-4 text-sm text-ink/45">No deductions this month.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="bg-ink/[0.03] text-xs uppercase tracking-wide text-ink/45">
                                            <tr>
                                                <th className="px-5 py-2.5 font-medium">Date</th>
                                                <th className="px-5 py-2.5 font-medium">Description / items</th>
                                                <th className="px-5 py-2.5 font-medium">Invoice</th>
                                                <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                                                {can('staff.edit') && <th className="print:hidden px-5 py-2.5 font-medium text-right"> </th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employee.meals.map((meal) => (
                                                <tr key={meal.id} className="border-t border-ink/5">
                                                    <td className="px-5 py-3 whitespace-nowrap">{meal.meal_date}</td>
                                                    <td className="px-5 py-3">
                                                        <p>{meal.description || 'Staff deduction'}</p>
                                                        {(meal.items || []).length > 0 && (
                                                            <ul className="mt-1 text-xs text-ink/55">
                                                                {meal.items.map((item, index) => (
                                                                    <li key={`${meal.id}-${index}`}>
                                                                        {item.quantity}× {item.name}
                                                                        {item.total != null ? ` — ${currency(item.total)}` : ''}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                        {meal.notes && <p className="mt-1 text-xs text-ink/45">{meal.notes}</p>}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">{meal.invoice_number || 'Manual'}</td>
                                                    <td className="px-5 py-3 text-right font-medium">{currency(meal.amount)}</td>
                                                    {can('staff.edit') && (
                                                        <td className="print:hidden px-5 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                disabled={busy}
                                                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-coral hover:bg-coral/5 disabled:opacity-40"
                                                                onClick={() => removeDeduction(meal.id)}
                                                            >
                                                                <Trash2 size={14} /> Remove
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}

            <FormModal
                open={deductOpen}
                title="Add custom deduction"
                description="Enter any amount to deduct from this employee’s salary (advance, damage, custom meal, etc.)."
                onClose={() => setDeductOpen(false)}
                onSubmit={saveDeduction}
                busy={busy}
                submitLabel="Save deduction"
            >
                <div className="grid gap-4">
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Employee *</span>
                        <select className="field" required value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                            <option value="">Select employee…</option>
                            {staffOptions.map((row) => (
                                <option key={row.id} value={row.id}>
                                    {row.first_name} {row.last_name} ({row.employee_id})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Amount *</span>
                        <input className="field" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500" />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Date</span>
                        <input className="field" type="date" value={form.meal_date} onChange={(e) => setForm({ ...form, meal_date: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Reason / description</span>
                        <input className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Custom salary deduction" />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-2 block font-medium">Notes (optional)</span>
                        <textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </label>
                </div>
            </FormModal>
        </div>
    );
}

function SummaryCard({ label, value, accent = false }) {
    return (
        <div className={`rounded-2xl border border-ink/10 bg-white px-5 py-4 ${accent ? 'ring-1 ring-emerald-200' : ''}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
            <p className={`mt-1 text-xl font-semibold ${accent ? 'text-emerald-700' : ''}`}>{value}</p>
        </div>
    );
}
