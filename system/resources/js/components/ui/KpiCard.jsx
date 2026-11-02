export default function KpiCard({ label, value, icon: Icon, tone = 'bg-primary-soft text-primary', hint }) {
    return (
        <article className="card-panel p-5">
            {Icon && (
                <div className={`grid size-11 place-items-center rounded-[5px] ${tone}`}>
                    <Icon size={20} />
                </div>
            )}
            <p className="mt-6 text-sm text-muted">{label}</p>
            <p className="mt-1 text-[28px] font-extrabold tracking-tight text-heading">{value}</p>
            {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
        </article>
    );
}
