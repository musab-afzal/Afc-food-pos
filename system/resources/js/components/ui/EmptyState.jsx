export default function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-ink/10 bg-white px-6 py-12 text-center">
            {Icon && (
                <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-ink/5 text-ink/40">
                    <Icon size={22} />
                </span>
            )}
            <p className="text-base font-semibold">{title}</p>
            {description && <p className="mt-2 max-w-sm text-sm text-ink/45">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
