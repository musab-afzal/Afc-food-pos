import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function WaitersReportPage() {
    return (
        <ReportShell
            title="Waiter / cashier report"
            description="Sales by cashier and open orders by creator."
            breadcrumbs={['Reports', 'Waiters']}
            endpoint="/reports/waiters"
            extraParams={{ limit: 25 }}
            exportType="waiters"
        >
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Sales total', value: currency(data?.totals?.sales ?? data?.totals?.grand_total) },
                        { label: 'Tickets', value: data?.totals?.orders ?? data?.totals?.sales_count ?? 0 },
                        { label: 'Avg ticket', value: currency(data?.totals?.average_ticket) },
                        { label: 'Open orders', value: data?.totals?.open_orders ?? 0 },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="By sales"
                            rows={data?.top_by_sales || data?.cashiers || data?.waiters || []}
                            columns={[
                                { key: 'name', label: 'Staff', render: (row) => row.name || row.cashier || row.user },
                                { key: 'orders', label: 'Sales', className: 'text-right', render: (row) => row.orders ?? row.sales_count },
                                { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total ?? row.grand_total) },
                                { key: 'share', label: 'Share', className: 'text-right', render: (row) => (row.share_percent != null ? `${row.share_percent}%` : '—') },
                            ]}
                        />
                        <SimpleTable
                            title="By ticket count"
                            rows={data?.top_by_orders || []}
                            columns={[
                                { key: 'name', label: 'Staff', render: (row) => row.name || row.cashier },
                                { key: 'orders', label: 'Sales', className: 'text-right', render: (row) => row.orders ?? row.sales_count },
                                { key: 'open_orders', label: 'Open', className: 'text-right', render: (row) => row.open_orders ?? row.open_count ?? 0 },
                                { key: 'total', label: 'Total', className: 'text-right', render: (row) => currency(row.total ?? row.grand_total) },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
