import ReportShell, { SimpleTable, StatGrid } from './ReportShell.jsx';

export default function StaffReportPage() {
    return (
        <ReportShell title="Staff report" description="Attendance and leave activity for the period." breadcrumbs={['Reports', 'Staff']} endpoint="/reports/staff" exportType="staff">
            {(data) => (
                <>
                    <StatGrid items={[
                        { label: 'Present', value: data?.attendance?.present ?? 0 },
                        { label: 'Late', value: data?.attendance?.late ?? 0 },
                        { label: 'Absent', value: data?.attendance?.absent ?? 0 },
                        { label: 'On leave', value: data?.attendance?.leave ?? 0 },
                    ]} />
                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <SimpleTable
                            title="Per staff"
                            rows={data?.attendance?.per_staff || []}
                            columns={[
                                { key: 'name', label: 'Employee', render: (row) => row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() },
                                { key: 'present', label: 'Present', className: 'text-right' },
                                { key: 'late', label: 'Late', className: 'text-right' },
                                { key: 'absent', label: 'Absent', className: 'text-right' },
                            ]}
                        />
                        <SimpleTable
                            title="Leaves"
                            rows={data?.leaves?.list || []}
                            columns={[
                                { key: 'staff', label: 'Employee', render: (row) => row.staff_name || row.name },
                                { key: 'leave_type', label: 'Type', render: (row) => <span className="capitalize">{row.leave_type}</span> },
                                { key: 'status', label: 'Status', render: (row) => <span className="capitalize">{row.status}</span> },
                            ]}
                        />
                    </section>
                </>
            )}
        </ReportShell>
    );
}
