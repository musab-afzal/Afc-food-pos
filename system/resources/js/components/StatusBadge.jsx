const tones = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/20 text-[#9A6B00]',
    danger: 'bg-coral/10 text-coral',
    info: 'bg-info/10 text-info',
    neutral: 'bg-light text-muted',
    lime: 'bg-primary-soft text-primary',
};

const aliases = {
    active: 'success', available: 'success', completed: 'success', paid: 'success', approved: 'success',
    delivered: 'success', ready: 'success', confirmed: 'success', received: 'success', settled: 'success',
    served: 'success',
    pending: 'warning', preparing: 'warning', held: 'warning', draft: 'warning', partially_paid: 'warning',
    assigned: 'warning', on_delivery: 'warning', late: 'warning', out_for_delivery: 'warning',
    new: 'info', accepted: 'info', busy: 'warning', offline: 'neutral',
    awaiting_assignment: 'warning', picked_up: 'info', on_the_way: 'warning',
    cancelled: 'danger', refunded: 'danger', failed: 'danger', suspended: 'danger', inactive: 'danger',
    rejected: 'danger', out_of_stock: 'danger', partially_refunded: 'danger',
    occupied: 'info', reserved: 'info', cleaning: 'neutral', unpaid: 'danger',
    held: 'info', approved: 'success', sent: 'success', ordered: 'warning',
    unavailable: 'danger',
};

export default function StatusBadge({
    status,
    label,
    tone,
    active,
    activeLabel = 'Active',
    inactiveLabel = 'Inactive',
}) {
    let resolvedStatus = status;
    let resolvedLabel = label;

    if (typeof active === 'boolean') {
        resolvedStatus = active ? 'active' : 'inactive';
        resolvedLabel = label || (active ? activeLabel : inactiveLabel);
    }

    const key = String(resolvedStatus || '').toLowerCase();
    const resolved = tone || aliases[key] || 'neutral';
    const text = resolvedLabel || String(resolvedStatus || '—').replace(/_/g, ' ');

    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tones[resolved] || tones.neutral}`}>
            {text}
        </span>
    );
}
