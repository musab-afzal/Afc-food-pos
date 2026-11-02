import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';
import { currency } from '../../utils/format.js';

export default function PurchasesReportPage() {
    return (
        <ReportShell title="Purchases report" description="Purchase orders and received value by supplier." breadcrumbs={['Reports', 'Purchases']} endpoint="/reports/purchases" exportType="purchases">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'PO total', value: currency(data?.totals?.total) },
                        { label: 'Received', value: currency(data?.totals?.received_value) },
                        { label: 'Orders', value: data?.totals?.orders ?? 0 },
                        { label: 'Outstanding', value: currency(data?.outstanding_payable) },
                    ]} />
                    <div className="mt-5">
                        <SimpleTable
                            title="By supplier"
                            rows={data?.by_supplier || []}
                            columns={[
                                { key: 'supplier', label: 'Supplier', render: (row) => row.supplier || row.name },
                                { key: 'total', label: 'Ordered', className: 'text-right', render: (row) => currency(row.total) },
                                { key: 'received', label: 'Received', className: 'text-right', render: (row) => currency(row.received_value ?? row.received) },
                                { key: 'orders', label: 'POs', className: 'text-right', render: (row) => row.orders ?? row.count },
                            ]}
                        />
                    </div>
                </>
            )}
        </ReportShell>
    );
}
