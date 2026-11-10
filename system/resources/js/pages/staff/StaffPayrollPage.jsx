import { Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

function currentMonth() {
    return new Date().toISOString().slice(0, 7);
}

export default function StaffPayrollPage() {
    const [month, setMonth] = useState(currentMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

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

    const employees = data?.employees || [];
    const totals = data?.totals || { salary: 0, meal_deductions: 0, net_pay: 0 };
    const title = useMemo(() => {
        if (!data?.month) return 'Staff payroll';
        const [year, mon] = data.month.split('-');
        const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
        return `Staff payroll — ${label}`;
    }, [data?.month]);

    function printReport() {
        window.print();
    }

    return (
        <div>
            <div className="print:hidden">
                <PageHeader
                    title="Staff Payroll"
                    description="Monthly salary minus staff meal deductions. Print the full detail at month end."
                    breadcrumbs={['Staff', 'Payroll']}
                    actions={(
                        <button type="button" onClick={printReport} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                            <Printer size={16} /> Print month report
                        </button>
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
                        <SummaryCard label="Meal deductions" value={currency(totals.meal_deductions)} />
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
                                <div className="grid grid-cols-3 gap-4 text-right text-sm">
                                    <div>
                                        <p className="text-ink/45">Salary</p>
                                        <p className="font-semibold">{currency(employee.salary)}</p>
                                    </div>
                                    <div>
                                        <p className="text-ink/45">Meals</p>
                                        <p className="font-semibold text-rose-700">−{currency(employee.meal_deductions)}</p>
                                    </div>
                                    <div>
                                        <p className="text-ink/45">Net</p>
                                        <p className="font-semibold text-emerald-700">{currency(employee.net_pay)}</p>
                                    </div>
                                </div>
                            </div>

                            {(employee.meals || []).length === 0 ? (
                                <p className="px-5 py-4 text-sm text-ink/45">No staff meals this month.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="bg-ink/[0.03] text-xs uppercase tracking-wide text-ink/45">
                                            <tr>
                                                <th className="px-5 py-2.5 font-medium">Date</th>
                                                <th className="px-5 py-2.5 font-medium">Description / items</th>
                                                <th className="px-5 py-2.5 font-medium">Invoice</th>
                                                <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employee.meals.map((meal) => (
                                                <tr key={meal.id} className="border-t border-ink/5">
                                                    <td className="px-5 py-3 whitespace-nowrap">{meal.meal_date}</td>
                                                    <td className="px-5 py-3">
                                                        <p>{meal.description || 'Staff meal'}</p>
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
                                                    <td className="px-5 py-3 whitespace-nowrap">{meal.invoice_number || '—'}</td>
                                                    <td className="px-5 py-3 text-right font-medium">{currency(meal.amount)}</td>
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
