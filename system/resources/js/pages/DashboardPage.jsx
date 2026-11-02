import {
    AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, CalendarDays, FileText, Flag,
    Hash, Layers, LifeBuoy, MapPin, PieChart, RefreshCw, Repeat, ShoppingBag, Users, UserCheck, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart as RePieChart, ReferenceLine,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { currency, formatDate } from '../utils/format.js';

const TX_TABS = [
    { key: 'sale', label: 'Sale', viewAll: '/sales' },
    { key: 'purchase', label: 'Purchase', viewAll: '/purchases' },
    { key: 'quotation', label: 'Quotation', viewAll: '/pos' },
    { key: 'expenses', label: 'Expenses', viewAll: '/finance/expenses' },
    { key: 'invoices', label: 'Invoices', viewAll: '/sales' },
];

function ChangeBadge({ value }) {
    const up = Number(value) >= 0;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${up ? 'bg-success/15 text-success' : 'bg-coral/10 text-coral'}`}>
            {up ? <ArrowUpRight size={12} className="me-0.5" /> : <ArrowDownRight size={12} className="me-0.5" />}
            {up ? '+' : ''}{Number(value || 0)}%
        </span>
    );
}

function SaleWidget({ title, value, change, tone, Icon, href }) {
    const tones = {
        primary: 'bg-primary',
        secondary: 'bg-secondary',
        teal: 'bg-[#0E9384]',
        info: 'bg-info',
    };
    const card = (
        <article className={`flex min-h-[110px] items-center rounded-lg ${tones[tone] || tones.primary} p-4 text-white soft-shadow transition hover:opacity-90`}>
            <span className="grid size-12 place-items-center rounded-full bg-white text-inherit shadow-sm">
                <Icon size={22} className={tone === 'secondary' ? 'text-secondary' : tone === 'teal' ? 'text-[#0E9384]' : tone === 'info' ? 'text-info' : 'text-primary'} />
            </span>
            <div className="ms-3 min-w-0">
                <p className="mb-1 text-sm text-white/85">{title}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-extrabold text-white">{currency(value)}</h4>
                    <ChangeBadge value={change} />
                </div>
            </div>
        </article>
    );
    return href ? <Link to={href} className="block">{card}</Link> : card;
}

function RevenueWidget({ title, value, change, href, Icon, iconClass }) {
    return (
        <article className="card-panel flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                <div>
                    <h4 className="text-xl font-extrabold text-heading">{currency(value)}</h4>
                    <p className="mt-1 text-sm text-muted">{title}</p>
                </div>
                <span className={`grid size-10 place-items-center rounded-full ${iconClass}`}>
                    <Icon size={16} />
                </span>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 text-[13px]">
                <p className="mb-0">
                    <span className={`font-bold ${Number(change) >= 0 ? 'text-success' : 'text-coral'}`}>
                        {Number(change) >= 0 ? '+' : ''}{Number(change || 0)}%
                    </span>
                    {' '}vs Last Month
                </p>
                <Link to={href} className="font-medium text-primary underline">View All</Link>
            </div>
        </article>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [alertOpen, setAlertOpen] = useState(true);
    const [statsYear, setStatsYear] = useState(new Date().getFullYear());
    const [txTab, setTxTab] = useState('sale');

    useEffect(() => {
        setLoading(true);
        api(`/dashboard?year=${statsYear}`)
            .then((response) => setData(response.data))
            .catch((caught) => setError(caught.message))
            .finally(() => setLoading(false));
    }, [statsYear]);

    const summary = data?.summary || {};
    const changes = data?.changes || {};
    const chartData = data?.chart || [];
    const chartTotals = useMemo(() => ({
        sales: chartData.reduce((sum, row) => sum + Number(row.sales || 0), 0),
        purchase: chartData.reduce((sum, row) => sum + Number(row.purchase || 0), 0),
    }), [chartData]);

    const firstLow = data?.low_stock?.[0];
    const salesStats = data?.sales_statistics || {};
    const txRows = data?.transactions?.[txTab] || [];
    const topCategories = data?.top_categories?.categories || [];
    const categoryTotal = Math.max(1, topCategories.reduce((sum, row) => sum + Number(row.sales || 0), 0));
    const heat = data?.order_statistics || { hours: [], days: [], cells: [], max: 1 };

    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-white" />)}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1500px] space-y-4">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="mb-1 text-[28px] font-extrabold text-heading">Welcome, {user?.name?.split(' ')[0] || 'Admin'}</h1>
                    <p className="text-sm font-medium text-muted">
                        You have <span className="font-bold text-primary">{data?.today?.orders ?? 0}+</span> Orders, Today
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-[5px] border border-border bg-white px-3 py-2 text-sm text-muted">
                    <CalendarDays size={16} />
                    {data?.period?.label || 'This Month'} · {formatDate(data?.period?.from)} – {formatDate(data?.period?.to)}
                </div>
            </div>

            {error && <p className="rounded-[5px] bg-coral/10 p-4 text-sm text-coral">{error}</p>}

            {alertOpen && data?.low_stock_count > 0 && (
                <div className="relative flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-heading">
                    <AlertTriangle size={16} className="text-primary" />
                    <span>
                        Your product{' '}
                        <span className="font-semibold text-primary">{firstLow?.name || 'inventory item'}</span>
                        {' '}is running low
                        {firstLow ? `, already at ${Number(firstLow.current_stock)} ${firstLow.unit || 'pcs'}` : ''}.
                        {' '}
                        <Link to="/inventory/stock" className="font-semibold text-primary underline">Add Stock</Link>
                    </span>
                    <button type="button" className="ms-auto text-muted" onClick={() => setAlertOpen(false)} aria-label="Dismiss">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Colored sale widgets */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SaleWidget title="Total Sales" value={summary.total_sales} change={changes.total_sales} tone="primary" Icon={FileText} href="/sales" />
                <SaleWidget title="Total Sales Return" value={summary.total_sales_return} change={changes.total_sales_return} tone="secondary" Icon={Repeat} href="/sales" />
                <SaleWidget title="Total Purchase" value={summary.total_purchase} change={changes.total_purchase} tone="teal" Icon={ShoppingBag} href="/purchases" />
                <SaleWidget title="Total Purchase Return" value={summary.total_purchase_return} change={changes.total_purchase_return} tone="info" Icon={RefreshCw} href="/purchases" />
            </div>

            {/* Revenue widgets */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <RevenueWidget title="Profit" value={summary.profit} change={changes.profit} href="/reports/finance" Icon={Layers} iconClass="bg-info/10 text-info" />
                <RevenueWidget title="Invoice Due" value={summary.invoice_due} change={changes.invoice_due} href="/purchases" Icon={PieChart} iconClass="bg-[#0E9384]/10 text-[#0E9384]" />
                <RevenueWidget title="Total Expenses" value={summary.total_expenses} change={changes.total_expenses} href="/finance/expenses" Icon={LifeBuoy} iconClass="bg-primary-soft text-primary" />
                <RevenueWidget title="Total Payment Returns" value={summary.total_payment_returns} change={changes.total_payment_returns} href="/sales" Icon={Hash} iconClass="bg-[#6938EF]/10 text-[#6938EF]" />
            </div>

            {/* Chart + Overall */}
            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <article className="card-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-primary-soft text-primary"><ShoppingBag size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Sales &amp; Purchase</h5>
                        </div>
                        <span className="rounded-[5px] border border-border px-2.5 py-1 text-xs font-bold text-muted">1Y</span>
                    </div>
                    <div className="p-4">
                        <div className="mb-4 flex flex-wrap gap-3">
                            <div className="rounded-[8px] border border-border px-3 py-2">
                                <p className="mb-1 inline-flex items-center text-xs text-muted">
                                    <span className="me-1 size-2 rounded-full bg-primary/40" /> Total Purchase
                                </p>
                                <h4 className="text-lg font-extrabold text-heading">{currency(chartTotals.purchase)}</h4>
                            </div>
                            <div className="rounded-[8px] border border-border px-3 py-2">
                                <p className="mb-1 inline-flex items-center text-xs text-muted">
                                    <span className="me-1 size-2 rounded-full bg-primary" /> Total Sales
                                </p>
                                <h4 className="text-lg font-extrabold text-heading">{currency(chartTotals.sales)}</h4>
                            </div>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAED" />
                                    <XAxis dataKey="label" tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(value) => currency(value)} contentStyle={{ borderRadius: 8, borderColor: '#E6EAED' }} />
                                    <Legend />
                                    <Bar dataKey="purchase" name="Purchase" fill="#FEC78B" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="sales" name="Sales" fill="#FE9F43" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </article>

                <article className="card-panel flex flex-col">
                    <div className="border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-info/10 text-info"><AlertTriangle size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Overall Information</h5>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 p-4">
                        {[
                            ['Suppliers', data?.overall?.suppliers, UserCheck, 'text-info'],
                            ['Customer', data?.overall?.customers, Users, 'text-primary'],
                            ['Orders', data?.overall?.orders, ShoppingBag, 'text-[#0E9384]'],
                        ].map(([label, value, Icon, color]) => (
                            <div key={label} className="rounded-[8px] border border-border bg-light p-3 text-center">
                                <Icon size={22} className={`mx-auto mb-2 ${color}`} />
                                <p className="mb-1 text-xs text-muted">{label}</p>
                                <h5 className="text-lg font-extrabold text-heading">{value ?? 0}</h5>
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto border-t border-border px-4 py-4">
                        <h5 className="mb-3 text-sm font-bold text-heading">Customers Overview</h5>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="border-e border-border pe-3 text-center">
                                <h2 className="mb-1 text-2xl font-extrabold text-heading">{data?.customers_overview?.first_time ?? 0}</h2>
                                <p className="mb-2 text-sm text-primary">First Time</p>
                                <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
                                    <ArrowUpRight size={12} className="me-0.5" />{data?.customers_overview?.first_time_pct ?? 0}%
                                </span>
                            </div>
                            <div className="text-center">
                                <h2 className="mb-1 text-2xl font-extrabold text-heading">{data?.customers_overview?.returning ?? 0}</h2>
                                <p className="mb-2 text-sm text-[#0E9384]">Return</p>
                                <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
                                    <ArrowUpRight size={12} className="me-0.5" />{data?.customers_overview?.returning_pct ?? 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </article>
            </div>

            {/* Top products / Low stock / Recent sales */}
            <div className="grid gap-4 xl:grid-cols-3">
                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-[#DD2590]/10 text-[#DD2590]"><Boxes size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Top Selling Products</h5>
                        </div>
                        <Link to="/reports/products" className="text-xs font-medium text-primary underline">View All</Link>
                    </div>
                    <div className="divide-y divide-border px-4">
                        {(data?.top_products || []).length ? data.top_products.map((product) => (
                            <div key={`${product.dish_id}-${product.dish_name}`} className="flex items-center justify-between gap-3 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="grid size-11 place-items-center rounded-[5px] bg-light text-sm font-bold text-primary">
                                        {(product.dish_name || '?').slice(0, 1).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-heading">{product.dish_name}</p>
                                        <p className="text-xs text-muted">{currency(product.avg_price)} · {Number(product.qty_sold)}+ Sales</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-heading">{currency(product.revenue)}</span>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-muted">No product sales this month.</p>}
                    </div>
                </article>

                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-coral/10 text-coral"><AlertTriangle size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Low Stock Products</h5>
                        </div>
                        <Link to="/inventory/stock" className="text-xs font-medium text-primary underline">View All</Link>
                    </div>
                    <div className="px-4 py-1">
                        {(data?.low_stock || []).length ? data.low_stock.map((item) => (
                            <div key={item.id} className="mb-4 flex items-center justify-between gap-3 last:mb-0">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="grid size-11 place-items-center rounded-[5px] bg-light text-sm font-bold text-coral">
                                        {(item.name || '?').slice(0, 1).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-heading">{item.name}</p>
                                        <p className="text-xs text-muted">SKU : {item.sku || '—'}</p>
                                    </div>
                                </div>
                                <div className="text-end">
                                    <p className="text-xs text-muted">In stock</p>
                                    <p className="font-bold text-primary">{Number(item.current_stock)}</p>
                                </div>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-muted">All stock levels look healthy.</p>}
                    </div>
                </article>

                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-[#DD2590]/10 text-[#DD2590]"><FileText size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Recent Sales</h5>
                        </div>
                        <Link to="/sales" className="text-xs font-medium text-primary underline">View All</Link>
                    </div>
                    <div className="px-4 py-1">
                        {(data?.recent_sales || []).length ? data.recent_sales.map((sale) => (
                            <div key={sale.id} className="mb-4 flex items-center justify-between gap-3 last:mb-0">
                                <div className="min-w-0">
                                    <Link to={`/sales/${sale.id}`} className="block truncate font-bold text-heading hover:text-primary">
                                        {sale.invoice_number}
                                    </Link>
                                    <p className="text-xs text-muted">
                                        {sale.customer?.name || sale.cashier?.name || 'Walk-in'} · {currency(sale.grand_total)}
                                    </p>
                                </div>
                                <div className="text-end">
                                    <p className="mb-1 text-xs text-muted">{formatDate(sale.sold_at)}</p>
                                    <StatusBadge status={sale.status} />
                                </div>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-muted">No sales yet.</p>}
                    </div>
                </article>
            </div>

            {/* Sales Statistics + Recent Transactions */}
            <div className="grid gap-4 xl:grid-cols-2">
                <article className="card-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-coral/10 text-coral"><AlertTriangle size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Sales Statistics</h5>
                        </div>
                        <select
                            className="rounded-[5px] border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-heading"
                            value={statsYear}
                            onChange={(e) => setStatsYear(Number(e.target.value))}
                        >
                            {(data?.available_years || [statsYear]).map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="p-4">
                        <div className="mb-4 flex flex-wrap gap-3">
                            <div className="rounded-[8px] border border-border px-3 py-2">
                                <h5 className="mb-1 inline-flex items-center gap-2 text-base font-extrabold text-[#0E9384]">
                                    {currency(salesStats.revenue)}
                                    <ChangeBadge value={salesStats.revenue_change} />
                                </h5>
                                <p className="text-xs text-muted">Revenue</p>
                            </div>
                            <div className="rounded-[8px] border border-border px-3 py-2">
                                <h5 className="mb-1 inline-flex items-center gap-2 text-base font-extrabold text-primary">
                                    {currency(salesStats.expense)}
                                    <ChangeBadge value={salesStats.expense_change} />
                                </h5>
                                <p className="text-xs text-muted">Expense</p>
                            </div>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={salesStats.months || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAED" />
                                    <XAxis dataKey="label" tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value, name) => [currency(Math.abs(Number(value || 0))), name === 'expense' ? 'Expense' : 'Revenue']}
                                        contentStyle={{ borderRadius: 8, borderColor: '#E6EAED' }}
                                    />
                                    <ReferenceLine y={0} stroke="#D3D5D7" />
                                    <Bar dataKey="revenue" name="Revenue" fill="#0E9384" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" name="Expense" fill="#FE9F43" radius={[0, 0, 4, 4]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </article>

                <article className="card-panel overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-primary-soft text-primary"><Flag size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Recent Transactions</h5>
                        </div>
                        <Link to={TX_TABS.find((t) => t.key === txTab)?.viewAll || '/sales'} className="text-xs font-medium text-primary underline">View All</Link>
                    </div>
                    <div className="flex overflow-x-auto border-b border-border">
                        {TX_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setTxTab(tab.key)}
                                className={`min-w-[88px] flex-1 px-3 py-3 text-sm font-semibold ${txTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                            <thead className="bg-light text-xs font-bold uppercase tracking-wide text-muted">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">{txTab === 'purchase' ? 'Supplier' : txTab === 'expenses' ? 'Expense' : 'Customer'}</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {txRows.length ? txRows.map((row) => (
                                    <tr key={`${txTab}-${row.id}`} className="hover:bg-primary/[.03]">
                                        <td className="px-4 py-3 text-muted">{formatDate(row.date)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                                    {(row.party || '?').slice(0, 1).toUpperCase()}
                                                </span>
                                                <div>
                                                    <Link to={row.link || '#'} className="font-bold text-heading hover:text-primary">{row.party}</Link>
                                                    <p className="text-xs text-primary">{row.code}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                                        <td className="px-4 py-3 text-right font-bold text-heading">{currency(row.total)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-muted">No transactions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>

            {/* Top Customers / Top Categories / Order Statistics */}
            <div className="grid gap-4 xl:grid-cols-3">
                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-info/10 text-info"><Users size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Top Customers</h5>
                        </div>
                        <Link to="/customers" className="text-xs font-medium text-primary underline">View All</Link>
                    </div>
                    <div className="divide-y divide-border px-4">
                        {(data?.top_customers || []).length ? data.top_customers.map((customer) => (
                            <div key={customer.id} className="flex items-center justify-between gap-3 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="grid size-11 place-items-center rounded-[8px] bg-light text-sm font-bold text-primary">
                                        {(customer.name || '?').slice(0, 1).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-heading">{customer.name}</p>
                                        <p className="inline-flex items-center gap-1 text-xs text-muted">
                                            <MapPin size={12} /> {customer.city} · {customer.orders_count} Orders
                                        </p>
                                    </div>
                                </div>
                                <span className="font-bold text-heading">{currency(customer.total_spent)}</span>
                            </div>
                        )) : <p className="py-10 text-center text-sm text-muted">No customer sales this month.</p>}
                    </div>
                </article>

                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-primary-soft text-primary"><PieChart size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Top Categories</h5>
                        </div>
                        <span className="rounded-[5px] border border-border px-2.5 py-1 text-xs font-bold text-muted">Weekly</span>
                    </div>
                    <div className="p-4">
                        <div className="mx-auto h-48 w-full max-w-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={topCategories.length ? topCategories : [{ name: 'None', sales: 1, color: '#E6EAED' }]}
                                        dataKey="sales"
                                        nameKey="name"
                                        innerRadius={48}
                                        outerRadius={72}
                                        paddingAngle={2}
                                    >
                                        {(topCategories.length ? topCategories : [{ color: '#E6EAED' }]).map((entry, index) => (
                                            <Cell key={entry.name || index} fill={entry.color || '#E6EAED'} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [`${value} sales`, name]} />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-2">
                            {topCategories.map((category) => (
                                <div key={category.id || category.name} className="flex items-center justify-between text-sm">
                                    <span className="inline-flex items-center gap-2 text-heading">
                                        <span className="size-2.5 rounded-full" style={{ background: category.color }} />
                                        {category.name}
                                    </span>
                                    <span className="font-bold text-muted">{category.sales} Sales · {Math.round((category.sales / categoryTotal) * 100)}%</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                            <div className="flex justify-between">
                                <span className="inline-flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-secondary" /> Total Categories</span>
                                <span className="font-bold text-heading">{data?.top_categories?.total_categories ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="inline-flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-primary" /> Total Products</span>
                                <span className="font-bold text-heading">{data?.top_categories?.total_products ?? 0}</span>
                            </div>
                        </div>
                    </div>
                </article>

                <article className="card-panel">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-[5px] bg-[#DD2590]/10 text-[#DD2590]"><CalendarDays size={16} /></span>
                            <h5 className="text-base font-bold text-heading">Order Statistics</h5>
                        </div>
                        <span className="rounded-[5px] border border-border px-2.5 py-1 text-xs font-bold text-muted">Weekly</span>
                    </div>
                    <div className="overflow-x-auto p-4">
                        <div className="min-w-[320px]">
                            <div className="mb-2 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1 text-center text-[11px] font-semibold text-muted">
                                <span />
                                {(heat.days || []).map((day) => <span key={day}>{day}</span>)}
                            </div>
                            <div className="space-y-1">
                                {(heat.hours || []).map((hour, hourIndex) => (
                                    <div key={hour} className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1">
                                        <span className="self-center text-[11px] text-muted">{hour}</span>
                                        {(heat.cells?.[hourIndex] || []).map((value, dayIndex) => {
                                            const intensity = Math.min(1, Number(value) / Math.max(1, Number(heat.max || 1)));
                                            const bg = intensity === 0
                                                ? '#FFF4E8'
                                                : `rgba(254, 159, 67, ${0.25 + intensity * 0.75})`;
                                            return (
                                                <div
                                                    key={`${hour}-${dayIndex}`}
                                                    title={`${heat.days?.[dayIndex]} ${hour}: ${value} orders`}
                                                    className="h-5 rounded-[3px]"
                                                    style={{ background: bg }}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
}
