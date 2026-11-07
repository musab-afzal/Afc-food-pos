import { Banknote, PiggyBank, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import { api } from '../../services/api.js';
import { currency, formatDateTime } from '../../utils/format.js';

const periods = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
];

export default function FinanceDashboardPage() {
    const [period, setPeriod] = useState('today');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api(`/finance/dashboard?period=${period}`)
            .then((response) => setData(response.data))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [period]);

    return (
        <div>
            <PageHeader
                title="Finance"
                description="Sales, expenses, incomes, and cash drawer health."
                breadcrumbs={['Finance', 'Dashboard']}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/finance/sales" className="btn-primary">Sales</Link>
                        <Link to="/finance/expenses" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Expenses</Link>
                        <Link to="/finance/cash-register" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Cash register</Link>
                    </div>
                )}
            />

            <div className="mb-5 flex flex-wrap gap-2">
                {periods.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setPeriod(item.key)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${period === item.key ? 'bg-ink text-white' : 'bg-white text-ink/70'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Sales" value={currency(data?.sales?.total)} icon={Receipt} tone="bg-lime" />
                        <KpiCard label="Expenses" value={currency(data?.expenses?.total)} icon={TrendingDown} tone="bg-[#ffe0d7]" />
                        <KpiCard label="Other income" value={currency(data?.incomes?.total)} icon={TrendingUp} tone="bg-[#dfe9d6]" />
                        <KpiCard label="Net" value={currency(data?.net)} icon={Wallet} tone="bg-[#d8e8ff]" />
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-3">
                        <article className="card-panel p-6 xl:col-span-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Cash register</p>
                                    <p className="text-sm text-ink/45">Live drawer sessions</p>
                                </div>
                                <StatusBadge status={data?.cash_register?.status || 'closed'} />
                            </div>
                            <div className="mt-4 divide-y divide-ink/7">
                                {(data?.cash_register?.open_registers || []).length ? data.cash_register.open_registers.map((register) => (
                                    <div key={register.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                                        <div>
                                            <p className="font-medium">{register.user?.name || 'Cashier'}</p>
                                            <p className="text-xs text-ink/40">Opened {formatDateTime(register.opened_at)} · float {currency(register.opening_amount)}</p>
                                        </div>
                                        <p className="font-semibold text-herb">{currency(register.expected_closing ?? register.opening_amount)}</p>
                                    </div>
                                )) : (
                                    <p className="py-8 text-center text-sm text-ink/40">
                                        No open registers.
                                        {data?.cash_register?.last_closed && (
                                            <span className="mt-1 block text-xs">Last closed {formatDateTime(data.cash_register.last_closed.closed_at)}</span>
                                        )}
                                    </p>
                                )}
                            </div>
                            <Link to="/finance/cash-register" className="mt-2 inline-flex text-sm font-semibold text-herb">Manage drawer →</Link>
                        </article>

                        <article className="card-panel p-6">
                            <div className="flex items-center gap-3">
                                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0bd]"><Banknote size={18} /></span>
                                <div>
                                    <p className="font-semibold">Accounts</p>
                                    <p className="text-sm text-ink/45">{data?.accounts?.count || 0} active</p>
                                </div>
                            </div>
                            <p className="mt-6 text-3xl font-semibold">{currency(data?.accounts?.total_balance)}</p>
                            <Link to="/finance/accounts" className="mt-4 inline-flex text-sm font-semibold text-herb">View accounts →</Link>
                        </article>
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <article className="card-panel p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Expenses by category</p>
                                    <p className="text-sm text-ink/45">{data?.expenses?.count || 0} entries</p>
                                </div>
                                <PiggyBank size={18} className="text-ink/30" />
                            </div>
                            <div className="divide-y divide-ink/7">
                                {(data?.expenses?.by_category || []).length ? data.expenses.by_category.map((row) => (
                                    <div key={row.category_id || row.category} className="flex justify-between py-3 text-sm">
                                        <span>{row.category}</span>
                                        <span className="font-semibold">{currency(row.total)}</span>
                                    </div>
                                )) : <p className="py-10 text-center text-sm text-ink/40">No expenses in this period.</p>}
                            </div>
                        </article>
                        <article className="card-panel p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Income by category</p>
                                    <p className="text-sm text-ink/45">{data?.incomes?.count || 0} entries</p>
                                </div>
                                <TrendingUp size={18} className="text-ink/30" />
                            </div>
                            <div className="divide-y divide-ink/7">
                                {(data?.incomes?.by_category || []).length ? data.incomes.by_category.map((row) => (
                                    <div key={row.category} className="flex justify-between py-3 text-sm">
                                        <span>{row.category}</span>
                                        <span className="font-semibold">{currency(row.total)}</span>
                                    </div>
                                )) : <p className="py-10 text-center text-sm text-ink/40">No other income in this period.</p>}
                            </div>
                        </article>
                    </section>
                </>
            )}
        </div>
    );
}
