import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import SearchInput from '../components/SearchInput.jsx';
import { api } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';

export default function ActivityLogsPage() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [query, setQuery] = useState('');
    const [module, setModule] = useState('');
    const [loading, setLoading] = useState(true);

    async function load(page = 1) {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), search: query });
            if (module) params.set('module', module);
            const response = await api(`/activity-logs?${params}`);
            setRows(response.data || []);
            setMeta(response.meta || null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => load(1), 250);
        return () => clearTimeout(timer);
    }, [query, module]);

    return (
        <div>
            <PageHeader
                title="Activity Logs"
                description="Audit trail of sensitive restaurant operations."
                breadcrumbs={['System', 'Activity Logs']}
            />
            <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[240px] flex-1">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search action, module, user…" />
                </div>
                <select className="field max-w-[200px]" value={module} onChange={(e) => setModule(e.target.value)}>
                    <option value="">All modules</option>
                    {['pos', 'menu', 'settings', 'staff', 'inventory', 'orders', 'kitchen', 'purchases', 'finance', 'promotions', 'delivery', 'tables'].map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
            </div>
            <DataTable
                loading={loading}
                rows={rows}
                emptyMessage="No activity recorded yet."
                columns={[
                    { key: 'created_at', label: 'When', render: (row) => formatDateTime(row.created_at) },
                    { key: 'user', label: 'User', render: (row) => row.user?.name || 'System' },
                    { key: 'module', label: 'Module' },
                    { key: 'action', label: 'Action' },
                    { key: 'description', label: 'Details', render: (row) => row.description || row.action },
                ]}
            />
            <Pagination meta={meta} onPage={load} />
        </div>
    );
}
