import { Bike, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import FormModal from '../../components/FormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Pagination from '../../components/Pagination.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePaginatedResource } from '../../hooks/usePaginatedResource.js';
import { api } from '../../services/api.js';

const money = (value) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));

const nextActions = {
    pending: [],
    awaiting_assignment: [],
    assigned: [{ status: 'picked_up', label: 'Picked up' }],
    picked_up: [{ status: 'on_the_way', label: 'On the way' }],
    on_the_way: [{ status: 'delivered', label: 'Delivered' }, { status: 'failed', label: 'Failed' }],
};

const needsAssignment = (status) => ['pending', 'awaiting_assignment'].includes(status);

export default function DeliveriesPage() {
    const { can } = useAuth();
    const [filters, setFilters] = useState({ search: '', status: '', page: 1, per_page: 15 });
    const { rows, meta, loading, reload } = usePaginatedResource('/deliveries', filters);
    const [riders, setRiders] = useState([]);
    const [assigning, setAssigning] = useState(null);
    const [riderId, setRiderId] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/riders?per_page=100&is_active=1').then((r) => setRiders(r.data || [])).catch(() => {});
    }, []);

    async function assign(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/deliveries/assign', {
                method: 'POST',
                body: JSON.stringify({
                    order_id: Number(assigning.order_id || assigning.order?.id),
                    rider_id: Number(riderId),
                    address: assigning.address || undefined,
                    phone: assigning.phone || undefined,
                }),
            });
            toast.success('Rider assigned');
            setAssigning(null);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function updateStatus(delivery, status) {
        setBusy(true);
        try {
            await api(`/deliveries/${delivery.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            toast.success(`Delivery → ${status.replace(/_/g, ' ')}`);
            reload();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Deliveries"
                description="Assign riders and track outbound orders."
                breadcrumbs={['Delivery', 'Active']}
                actions={(
                    <Link to="/riders" className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                        <Bike size={16} /> Manage riders
                    </Link>
                )}
            />

            <div className="mb-4 flex flex-wrap gap-3">
                <SearchInput value={filters.search} onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} placeholder="Order #, phone, address…" className="min-w-[220px] flex-1" />
                <select className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
                    <option value="">All statuses</option>
                    {['pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed', 'cancelled'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </div>

            <DataTable
                loading={loading}
                emptyMessage="No deliveries yet. Create a delivery-type order from POS."
                rows={rows}
                columns={[
                    { key: 'order', label: 'Order', render: (row) => row.order?.order_number || `#${row.order_id}` },
                    { key: 'phone', label: 'Phone' },
                    { key: 'address', label: 'Address', render: (row) => <span className="line-clamp-2 max-w-xs">{row.address}</span> },
                    { key: 'rider', label: 'Rider', render: (row) => row.rider?.name || 'Unassigned' },
                    { key: 'cod_amount', label: 'COD', className: 'text-right', render: (row) => money(row.cod_amount) },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'actions',
                        label: '',
                        className: 'text-right',
                        render: (row) => (
                            <div className="flex flex-wrap justify-end gap-2">
                                {(can('orders.assign_rider') || can('riders.manage')) && needsAssignment(row.status) && (
                                    <button type="button" onClick={() => { setAssigning(row); setRiderId(''); }} className="inline-flex items-center gap-1 text-sm font-semibold text-herb">
                                        <UserPlus size={14} /> Assign
                                    </button>
                                )}
                                {can('orders.update') && (nextActions[row.status] || []).map((action) => (
                                    <button
                                        key={action.status}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => updateStatus(row, action.status)}
                                        className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                                {row.order_id && (
                                    <Link to={`/orders/${row.order_id}`} className="text-sm font-semibold text-ink/60">Order</Link>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
            <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

            <FormModal open={Boolean(assigning)} title="Assign rider" onClose={() => setAssigning(null)} onSubmit={assign} busy={busy}>
                <p className="mb-4 text-sm text-ink/55">Order {assigning?.order?.order_number || assigning?.order_id}</p>
                <label className="block text-sm">
                    <span className="mb-2 block font-medium">Rider</span>
                    <select className="field" required value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                        <option value="">Select rider</option>
                        {riders.filter((r) => r.is_active && r.status !== 'offline').map((rider) => (
                            <option key={rider.id} value={rider.id}>{rider.name} · {rider.status}</option>
                        ))}
                    </select>
                </label>
            </FormModal>
        </div>
    );
}
