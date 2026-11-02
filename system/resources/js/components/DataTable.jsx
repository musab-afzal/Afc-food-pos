export default function DataTable({ columns, rows, loading, emptyMessage = 'No records found.' }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-white soft-shadow">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                    <thead className="border-b border-border bg-light text-xs font-bold uppercase tracking-wide text-muted">
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key} className={`px-4 py-3.5 ${column.className || ''}`}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading
                            ? Array.from({ length: 5 }).map((_, index) => (
                                <tr key={index}>
                                    {columns.map((column) => (
                                        <td key={column.key} className="px-4 py-4">
                                            <div className="h-4 animate-pulse rounded bg-border" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : rows.map((row) => (
                                <tr key={row.id} className="transition hover:bg-primary/[.04]">
                                    {columns.map((column) => (
                                        <td key={column.key} className={`px-4 py-3.5 text-sm text-heading ${column.className || ''}`}>
                                            {column.render ? column.render(row) : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            {!loading && !rows.length && (
                <div className="grid min-h-48 place-items-center text-sm text-muted">{emptyMessage}</div>
            )}
        </div>
    );
}
