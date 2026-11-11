import { useMemo } from 'react';
import LineTrendChart from '../../components/charts/LineTrendChart.jsx';
import { currency, formatDate } from '../../utils/format.js';
import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';

export default function FinanceReportPage() {
    return (
        <ReportShell title="Finance report" description="Sales versus expenses and other income." breadcrumbs={['Reports', 'Finance']} endpoint="/reports/finance" exportType="finance">
            {(data) => <FinanceReportBody data={data} />}
        </ReportShell>
    );
}

function FinanceReportBody({ data }) {
    const dailyChart = useMemo(
        () => (data?.daily || []).map((row) => ({
            label: formatDate(row.date),
            sales: Number(row.sales || 0),
            expenses: Number(row.expenses || 0),
            incomes: Number(row.incomes || 0),
            net: Number(row.net || 0),
        })),
        [data],
    );

    return (
        <>
            <StatGrid items={[
                { label: 'Sales', value: currency(data?.totals?.sales) },
                { label: 'Expenses', value: currency(data?.totals?.expenses) },
                { label: 'Income', value: currency(data?.totals?.incomes) },
                { label: 'Net', value: currency(data?.totals?.net) },
            ]} />

            <article className="card-panel mt-5 p-5">
                <h3 className="mb-4 text-base font-semibold">Finance trend</h3>
                <LineTrendChart
                    data={dailyChart}
                    xKey="label"
                    height={300}
                    formatter={(value) => currency(value)}
                    series={[
                        { key: 'sales', name: 'Sales', color: '#FE9F43' },
                        { key: 'expenses', name: 'Expenses', color: '#F04438' },
                        { key: 'incomes', name: 'Income', color: '#0E9384' },
                        { key: 'net', name: 'Net', color: '#6938EF' },
                    ]}
                />
            </article>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
                <SimpleTable
                    title="Expenses by category"
                    rows={data?.expenses_by_category || []}
                    columns={[
                        { key: 'category', label: 'Category', render: (row) => row.category || row.name },
                        { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total) },
                    ]}
                />
                <SimpleTable
                    title="Income by category"
                    rows={data?.incomes_by_category || []}
                    columns={[
                        { key: 'category', label: 'Category' },
                        { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total) },
                    ]}
                />
            </section>
        </>
    );
}
