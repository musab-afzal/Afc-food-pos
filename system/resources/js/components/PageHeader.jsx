export default function PageHeader({
    title,
    description,
    breadcrumbs = [],
    eyebrow,
    actions,
    action,
}) {
    const headerActions = actions ?? action;

    return (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                {eyebrow && (
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-[.14em] text-primary">{eyebrow}</p>
                )}
                {breadcrumbs.length > 0 && (
                    <p className="mb-1.5 text-xs font-semibold text-muted">
                        {breadcrumbs.join(' / ')}
                    </p>
                )}
                <h1 className="page-title">{title}</h1>
                {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
            </div>
            {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
        </header>
    );
}
