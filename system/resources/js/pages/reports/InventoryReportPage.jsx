import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function InventoryReportPage() {
    return (
        <ReportShell title="Inventory report" description="Valuation, low stock, wastage, and consumption." breadcrumbs={['Reports', 'Inventory']} endpoint="/reports/inventory" exportType="inventory">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Valuation', value: currency(data?.valuation?.total) },
                        { label: 'Low stock', value: data?.stock?.low_stock_count ?? 0 },
                        { label: 'Out of stock', value: data?.stock?.out_of_stock_count ?? 0 },
                        { label: 'Wastage cost', value: currency(data?.wastage?.cost) },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="Low stock items"
                            rows={data?.stock?.low_stock_items || []}
                            columns={[
                                { key: 'name', label: 'Item' },
                                { key: 'current_stock', label: 'Stock', className: 'text-right', render: (row) => `${row.current_stock} ${row.unit || ''}` },
                            ]}
                        />
                        <SimpleTable
                            title="Top consumed"
                            rows={data?.top_consumed || []}
                            columns={[
                                { key: 'name', label: 'Item', render: (row) => row.name || row.item_name },
                                { key: 'quantity', label: 'Qty', className: 'text-right', render: (row) => row.quantity ?? row.consumed },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
