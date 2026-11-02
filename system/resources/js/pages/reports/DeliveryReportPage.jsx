import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function DeliveryReportPage() {
    return (
        <ReportShell title="Delivery report" description="Delivery volume, COD, and rider performance." breadcrumbs={['Reports', 'Delivery']} endpoint="/reports/delivery" exportType="delivery">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Deliveries', value: data?.totals?.deliveries ?? 0 },
                        { label: 'Delivered', value: data?.totals?.delivered ?? 0 },
                        { label: 'COD collected', value: currency(data?.cod?.collected) },
                        { label: 'Failed', value: data?.totals?.failed ?? 0 },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="By status"
                            rows={data?.by_status || []}
                            columns={[
                                { key: 'status', label: 'Status', render: (row) => <span className="capitalize">{String(row.status).replace(/_/g, ' ')}</span> },
                                { key: 'deliveries', label: 'Count', className: 'text-right' },
                                { key: 'cod', label: 'COD', className: 'text-right', render: (row) => currency(row.cod) },
                            ]}
                        />
                        <SimpleTable
                            title="Riders"
                            rows={data?.riders || []}
                            columns={[
                                { key: 'name', label: 'Rider' },
                                { key: 'deliveries', label: 'Jobs', className: 'text-right' },
                                { key: 'cod', label: 'COD', className: 'text-right', render: (row) => currency(row.cod ?? row.cod_collected) },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
