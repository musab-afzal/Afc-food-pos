import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function FinanceReportPage() {
    return (
        <ReportShell title="Finance report" description="Sales versus expenses and other income." breadcrumbs={['Reports', 'Finance']} endpoint="/reports/finance" exportType="finance">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Sales', value: currency(data?.totals?.sales) },
                        { label: 'Expenses', value: currency(data?.totals?.expenses) },
                        { label: 'Income', value: currency(data?.totals?.incomes) },
                        { label: 'Net', value: currency(data?.totals?.net) },
                    ]} />
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
            )}
        </ReportShell>
    );
}
