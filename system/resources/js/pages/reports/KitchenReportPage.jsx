import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';

export default function KitchenReportPage() {
    return (
        <ReportShell title="Kitchen report" description="Ticket throughput and stage timing." breadcrumbs={['Reports', 'Kitchen']} endpoint="/reports/kitchen" exportType="kitchen">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Tickets', value: data?.totals?.tickets ?? data?.tickets ?? 0 },
                        { label: 'Completed', value: data?.totals?.completed ?? data?.by_status?.completed ?? 0 },
                        { label: 'Avg ready (min)', value: data?.averages?.ready_minutes ?? data?.avg_ready_minutes ?? '—' },
                        { label: 'Avg complete (min)', value: data?.averages?.complete_minutes ?? data?.avg_complete_minutes ?? '—' },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="By status"
                            rows={Array.isArray(data?.by_status)
                                ? data.by_status
                                : Object.entries(data?.by_status || {}).map(([status, count]) => ({ status, count }))}
                            columns={[
                                { key: 'status', label: 'Status', render: (row) => <span className="capitalize">{String(row.status).replace(/_/g, ' ')}</span> },
                                { key: 'count', label: 'Count', className: 'text-right', render: (row) => row.count ?? row.tickets },
                            ]}
                        />
                        <SimpleTable
                            title="Daily tickets"
                            rows={data?.daily || data?.tickets_per_day || []}
                            columns={[
                                { key: 'date', label: 'Date' },
                                { key: 'tickets', label: 'Tickets', className: 'text-right', render: (row) => row.tickets ?? row.count },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
