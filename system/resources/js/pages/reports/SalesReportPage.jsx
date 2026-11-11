import { useMemo } from 'react';
import LineTrendChart from '../../components/charts/LineTrendChart.jsx';
import { currency, formatDate } from '../../utils/format.js';
import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';

export default function SalesReportPage() {
    return (
        <ReportShell title="Sales report" description="Completed sales, tender mix, and daily trend." breadcrumbs={['Reports', 'Sales']} endpoint="/reports/sales" exportType="sales">
            {(data) => <SalesReportBody data={data} />}
        </ReportShell>
    );
}

function SalesReportBody({ data }) {
    const dailyChart = useMemo(
        () => (data?.daily || []).map((row) => ({
            label: formatDate(row.date),
            sales: Number(row.total || 0),
            tickets: Number(row.orders || row.count || 0),
        })),
        [data],
    );

    return (
        <>
            <StatGrid items={[
                { label: 'Gross sales', value: currency(data?.totals?.total) },
                { label: 'Tickets', value: data?.totals?.orders ?? 0 },
                { label: 'Avg ticket', value: currency(data?.totals?.average_ticket) },
                { label: 'Tax', value: currency(data?.totals?.tax) },
            ]} />

            <article className="card-panel mt-5 p-5">
                <h3 className="mb-4 text-base font-semibold">Daily sales trend</h3>
                <LineTrendChart
                    data={dailyChart}
                    xKey="label"
                    height={300}
                    formatter={(value, name) => (name === 'Tickets' ? [value, 'Tickets'] : [currency(value), name])}
                    series={[
                        { key: 'sales', name: 'Sales', color: '#FE9F43' },
                        { key: 'tickets', name: 'Tickets', color: '#0E9384' },
                    ]}
                />
            </article>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
                <SimpleTable
                    title="By payment method"
                    rows={data?.by_payment_method || []}
                    columns={[
                        { key: 'name', label: 'Method', render: (row) => row.name || row.code },
                        { key: 'net_amount', label: 'Net', className: 'text-right', render: (row) => currency(row.net_amount ?? row.tendered) },
                        { key: 'payments_count', label: 'Count', className: 'text-right', render: (row) => row.payments_count ?? row.count },
                    ]}
                />
                <SimpleTable
                    title="By order type"
                    rows={data?.by_order_type || []}
                    columns={[
                        { key: 'order_type', label: 'Type', render: (row) => <span className="capitalize">{row.order_type || row.label}</span> },
                        { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total) },
                        { key: 'orders', label: 'Count', className: 'text-right', render: (row) => row.orders ?? row.count },
                    ]}
                />
            </section>
            <div className="mt-5">
                <SimpleTable
                    title="Daily series"
                    rows={data?.daily || []}
                    columns={[
                        { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                        { key: 'total', label: 'Sales', className: 'text-right', render: (row) => currency(row.total) },
                        { key: 'orders', label: 'Tickets', className: 'text-right', render: (row) => row.orders ?? row.count },
                    ]}
                />
            </div>
        </>
    );
}
