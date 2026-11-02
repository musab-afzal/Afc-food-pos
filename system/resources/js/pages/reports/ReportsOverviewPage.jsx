import { Link } from 'react-router-dom';
import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

const links = [
    { to: '/reports/sales', label: 'Sales' },
    { to: '/reports/products', label: 'Products' },
    { to: '/reports/inventory', label: 'Inventory' },
    { to: '/reports/purchases', label: 'Purchases' },
    { to: '/reports/finance', label: 'Finance' },
    { to: '/reports/staff', label: 'Staff' },
    { to: '/reports/delivery', label: 'Delivery' },
    { to: '/reports/kitchen', label: 'Kitchen' },
    { to: '/reports/customers', label: 'Customers' },
    { to: '/reports/waiters', label: 'Waiters' },
];

export default function ReportsOverviewPage() {
    return (
        <ReportShell
            title="Reports"
            description="Operational KPIs across sales, stock, people, and delivery."
            breadcrumbs={['Reports', 'Overview']}
            endpoint="/reports/overview"
        >
            {(data) => (
                <>
                    <div className="mb-5 flex flex-wrap gap-2">
                        {links.map((link) => (
                            <Link key={link.to} to={link.to} className="rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm font-semibold">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                    <StatGrid items={[
                        { label: 'Sales', value: currency(data?.sales?.total ?? data?.sales?.totals?.total) },
                        { label: 'Orders', value: data?.sales?.orders ?? data?.sales?.totals?.orders ?? 0 },
                        { label: 'Net (finance)', value: currency(data?.finance?.net ?? data?.finance?.totals?.net) },
                        { label: 'Low stock', value: data?.inventory?.low_stock ?? data?.inventory?.stock?.low_stock_count ?? 0 },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="Expense categories"
                            rows={data?.finance?.expenses_by_category || []}
                            columns={[
                                { key: 'category', label: 'Category', render: (row) => row.category || row.name },
                                { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total) },
                            ]}
                        />
                        <SimpleTable
                            title="Delivery statuses"
                            rows={data?.delivery?.by_status || []}
                            columns={[
                                { key: 'status', label: 'Status', render: (row) => <span className="capitalize">{String(row.status).replace(/_/g, ' ')}</span> },
                                { key: 'deliveries', label: 'Count', className: 'text-right', render: (row) => row.deliveries ?? row.count },
                            ]}
                            empty="No delivery activity in this period."
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
