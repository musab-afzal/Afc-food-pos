import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function ProductsReportPage() {
    return (
        <ReportShell title="Product report" description="Top-selling dishes by quantity and revenue." breadcrumbs={['Reports', 'Products']} endpoint="/reports/dishes" extraParams={{ limit: 25 }} exportType="dishes">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Dishes sold', value: data?.totals?.quantity ?? 0 },
                        { label: 'Revenue', value: currency(data?.totals?.revenue) },
                        { label: 'SKUs', value: data?.totals?.distinct_dishes ?? 0 },
                        { label: 'Top dish', value: (data?.top_by_revenue || [])[0]?.dish_name || (data?.top_by_revenue || [])[0]?.name || '—' },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="Top by quantity"
                            rows={data?.top_by_quantity || []}
                            columns={[
                                { key: 'name', label: 'Dish', render: (row) => row.dish_name || row.name },
                                { key: 'quantity', label: 'Qty', className: 'text-right' },
                                { key: 'revenue', label: 'Revenue', className: 'text-right', render: (row) => currency(row.revenue) },
                            ]}
                        />
                        <SimpleTable
                            title="Top by revenue"
                            rows={data?.top_by_revenue || []}
                            columns={[
                                { key: 'name', label: 'Dish', render: (row) => row.dish_name || row.name },
                                { key: 'quantity', label: 'Qty', className: 'text-right' },
                                { key: 'revenue', label: 'Revenue', className: 'text-right', render: (row) => currency(row.revenue) },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
