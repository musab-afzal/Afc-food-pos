import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function CustomersReportPage() {
    return (
        <ReportShell title="Customers report" description="Spend leaders, new guests, and loyalty." breadcrumbs={['Reports', 'Customers']} endpoint="/reports/customers" extraParams={{ limit: 20 }} exportType="customers">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'New customers', value: data?.new_customers?.total ?? data?.new_customers ?? 0 },
                        { label: 'Buying customers', value: data?.buying_customers ?? data?.totals?.buying ?? 0 },
                        { label: 'Loyalty outstanding', value: data?.loyalty?.points_outstanding ?? data?.loyalty?.outstanding ?? 0 },
                        { label: 'Identified spend', value: currency(data?.spend?.identified ?? data?.identified_spend) },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="Top customers"
                            rows={data?.top_customers || []}
                            columns={[
                                { key: 'name', label: 'Customer', render: (row) => row.name || row.customer },
                                { key: 'orders', label: 'Orders', className: 'text-right', render: (row) => row.orders ?? row.count },
                                { key: 'spend', label: 'Spend', className: 'text-right', render: (row) => currency(row.spend ?? row.total) },
                            ]}
                        />
                        <SimpleTable
                            title="Top loyalty holders"
                            rows={data?.loyalty?.top_holders || data?.top_loyalty || []}
                            columns={[
                                { key: 'name', label: 'Customer' },
                                { key: 'points', label: 'Points', className: 'text-right', render: (row) => row.points ?? row.loyalty_points },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
