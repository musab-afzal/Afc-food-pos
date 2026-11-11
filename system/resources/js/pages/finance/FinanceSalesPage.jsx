import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import LineTrendChart from '../../components/charts/LineTrendChart.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import { api } from '../../services/api.js';
import { currency, formatDate, formatDateTime } from '../../utils/format.js';

const PRESETS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
];

const PIE_COLORS = ['#0E9384', '#FE9F43', '#3B82F6', '#F43F5E', '#8B5CF6', '#84CC16'];

function toYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function rangeForPreset(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === 'yesterday') {
        const day = new Date(today);
        day.setDate(day.getDate() - 1);
        return { from: toYmd(day), to: toYmd(day) };
    }
    if (preset === 'week') {
        const start = new Date(today);
        const weekday = (start.getDay() + 6) % 7; // Monday start
        start.setDate(start.getDate() - weekday);
        return { from: toYmd(start), to: toYmd(today) };
    }
    if (preset === 'month') {
        return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toYmd(today) };
    }
    return { from: toYmd(today), to: toYmd(today) };
}

export default function FinanceSalesPage() {
    const initial = rangeForPreset('today');
    const [preset, setPreset] = useState('today');
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [report, setReport] = useState(null);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    function applyPreset(key) {
        setPreset(key);
        if (key === 'custom') return;
        const next = rangeForPreset(key);
        setFrom(next.from);
        setTo(next.to);
    }

    useEffect(() => {
        if (!from || !to) return;
        setLoading(true);
        const params = new URLSearchParams({ from, to });
        const salesParams = new URLSearchParams({ date_from: from, date_to: to, per_page: '50' });
        Promise.all([
            api(`/reports/sales?${params}`),
            api(`/sales?${salesParams}`),
        ])
            .then(([reportRes, salesRes]) => {
                setReport(reportRes.data || null);
                setSales(salesRes.data || []);
            })
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [from, to]);

    const dailyChart = useMemo(
        () => (report?.daily || []).map((row) => ({
            label: formatDate(row.date),
            sales: Number(row.total || 0),
            tickets: Number(row.orders || 0),
        })),
        [report],
    );

    const paymentChart = useMemo(
        () => (report?.by_payment_method || []).map((row) => ({
            name: row.name || row.code || 'Other',
            value: Number(row.net_amount ?? row.tendered ?? 0),
        })).filter((row) => row.value > 0),
        [report],
    );

    const typeChart = useMemo(
        () => (report?.by_order_type || []).map((row) => ({
            name: String(row.order_type || '').replace(/_/g, ' '),
            value: Number(row.total || 0),
            orders: Number(row.orders || 0),
        })),
        [report],
    );

    return (
        <div>
            <PageHeader
                title="Sales"
                description="Sales graphs, totals, and ticket list for any period."
                breadcrumbs={['Finance', 'Sales']}
                actions={<Link to="/finance" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Finance dashboard</Link>}
            />

            <div className="mb-5 flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => applyPreset(item.key)}
                            className={`rounded-xl px-4 py-2 text-sm font-medium ${preset === item.key ? 'bg-ink text-white' : 'bg-white text-ink/70'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <label className="text-sm font-medium">
                    From
                    <input
                        type="date"
                        className="field mt-1"
                        value={from}
                        onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }}
                    />
                </label>
                <label className="text-sm font-medium">
                    To
                    <input
                        type="date"
                        className="field mt-1"
                        value={to}
                        onChange={(e) => { setPreset('custom'); setTo(e.target.value); }}
                    />
                </label>
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Gross sales" value={currency(report?.totals?.total)} tone="bg-lime" />
                        <KpiCard label="Tickets" value={report?.totals?.orders ?? 0} tone="bg-[#d8e8ff]" />
                        <KpiCard label="Avg ticket" value={currency(report?.totals?.average_ticket)} tone="bg-[#fff0bd]" />
                        <KpiCard label="Discounts" value={currency(report?.totals?.discount ?? report?.totals?.discounts)} tone="bg-[#ffe0d7]" />
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-3">
                        <article className="card-panel p-5 xl:col-span-2">
                            <h3 className="mb-4 text-base font-semibold">Sales trend</h3>
                            <LineTrendChart
                                data={dailyChart}
                                xKey="label"
                                height={288}
                                formatter={(value, name) => (name === 'Tickets' ? [value, 'Tickets'] : [currency(value), name])}
                                series={[
                                    { key: 'sales', name: 'Sales', color: '#0E9384' },
                                    { key: 'tickets', name: 'Tickets', color: '#3B82F6' },
                                ]}
                            />
                        </article>

                        <article className="card-panel p-5">
                            <h3 className="mb-4 text-base font-semibold">By payment method</h3>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={paymentChart.length ? paymentChart : [{ name: 'None', value: 1 }]} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                                            {(paymentChart.length ? paymentChart : [{ name: 'None' }]).map((entry, index) => (
                                                <Cell key={entry.name} fill={paymentChart.length ? PIE_COLORS[index % PIE_COLORS.length] : '#E6EAED'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => currency(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2 space-y-1.5 text-sm">
                                {paymentChart.map((row, index) => (
                                    <div key={row.name} className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="size-2.5 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                                            {row.name}
                                        </span>
                                        <strong>{currency(row.value)}</strong>
                                    </div>
                                ))}
                                {!paymentChart.length && <p className="text-ink/40">No payments in this period.</p>}
                            </div>
                        </article>
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <article className="card-panel overflow-hidden">
                            <div className="border-b border-ink/10 px-5 py-4">
                                <h3 className="font-semibold">By order type</h3>
                            </div>
                            <div className="h-64 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={typeChart}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAED" />
                                        <XAxis dataKey="name" tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(value) => currency(value)} contentStyle={{ borderRadius: 8, borderColor: '#E6EAED' }} />
                                        <Bar dataKey="value" name="Sales" fill="#FE9F43" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-ink/5 text-left text-ink/50">
                                        <tr>
                                            <th className="px-5 py-2 font-medium">Type</th>
                                            <th className="px-5 py-2 text-right font-medium">Tickets</th>
                                            <th className="px-5 py-2 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {typeChart.map((row) => (
                                            <tr key={row.name} className="border-t border-ink/5">
                                                <td className="px-5 py-2.5 capitalize">{row.name || '—'}</td>
                                                <td className="px-5 py-2.5 text-right">{row.orders}</td>
                                                <td className="px-5 py-2.5 text-right font-semibold">{currency(row.value)}</td>
                                            </tr>
                                        ))}
                                        {!typeChart.length && <tr><td colSpan={3} className="px-5 py-8 text-center text-ink/40">No sales for this period.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </article>

                        <article className="card-panel overflow-hidden">
                            <div className="border-b border-ink/10 px-5 py-4">
                                <h3 className="font-semibold">Daily breakdown</h3>
                            </div>
                            <div className="max-h-[28rem] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-ink/5 text-left text-ink/50">
                                        <tr>
                                            <th className="px-5 py-2 font-medium">Date</th>
                                            <th className="px-5 py-2 text-right font-medium">Tickets</th>
                                            <th className="px-5 py-2 text-right font-medium">Sales</th>
                                            <th className="px-5 py-2 text-right font-medium">Discount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(report?.daily || []).map((row) => (
                                            <tr key={row.date} className="border-t border-ink/5">
                                                <td className="px-5 py-2.5">{formatDate(row.date)}</td>
                                                <td className="px-5 py-2.5 text-right">{row.orders}</td>
                                                <td className="px-5 py-2.5 text-right font-semibold">{currency(row.total)}</td>
                                                <td className="px-5 py-2.5 text-right">{currency(row.discounts)}</td>
                                            </tr>
                                        ))}
                                        {!(report?.daily || []).length && <tr><td colSpan={4} className="px-5 py-8 text-center text-ink/40">No daily data.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    </section>

                    <article className="card-panel mt-5 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
                            <div>
                                <h3 className="font-semibold">Sales tickets</h3>
                                <p className="text-sm text-ink/45">Latest sales in the selected period</p>
                            </div>
                            <Link to="/sales" className="text-sm font-semibold text-herb">All sales →</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-ink/5 text-left text-ink/50">
                                    <tr>
                                        <th className="px-5 py-2.5 font-medium">Invoice</th>
                                        <th className="px-5 py-2.5 font-medium">Date</th>
                                        <th className="px-5 py-2.5 font-medium">Type</th>
                                        <th className="px-5 py-2.5 font-medium">Cashier</th>
                                        <th className="px-5 py-2.5 font-medium">Status</th>
                                        <th className="px-5 py-2.5 text-right font-medium">Total</th>
                                        <th className="px-5 py-2.5 text-right font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map((sale) => (
                                        <tr key={sale.id} className="border-t border-ink/5">
                                            <td className="px-5 py-3 font-medium">{sale.invoice_number}</td>
                                            <td className="px-5 py-3">{formatDateTime(sale.sold_at)}</td>
                                            <td className="px-5 py-3 capitalize">{String(sale.order_type || '').replace(/_/g, ' ')}</td>
                                            <td className="px-5 py-3">{sale.cashier?.name || '—'}</td>
                                            <td className="px-5 py-3"><StatusBadge status={sale.status || sale.payment_status || 'completed'} /></td>
                                            <td className="px-5 py-3 text-right font-semibold">{currency(sale.grand_total)}</td>
                                            <td className="px-5 py-3 text-right">
                                                <Link to={`/sales/${sale.id}`} className="font-semibold text-herb">View</Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {!sales.length && (
                                        <tr><td colSpan={7} className="px-5 py-10 text-center text-ink/40">No sales tickets in this period.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </>
            )}
        </div>
    );
}
