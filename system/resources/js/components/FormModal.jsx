import { X } from 'lucide-react';

export default function FormModal({
    open,
    title,
    description,
    children,
    onClose,
    onSubmit,
    busy,
    submitLabel = 'Save changes',
    wide = false,
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-secondary/50 p-4">
            <form
                onSubmit={onSubmit}
                className={`my-6 w-full rounded-lg border border-border bg-white p-6 soft-shadow ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            >
                <div className="flex items-start justify-between gap-5">
                    <div>
                        <h2 className="text-xl font-bold text-heading">{title}</h2>
                        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid size-9 place-items-center rounded-[5px] bg-light text-muted"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="mt-6">{children}</div>
                <div className="mt-7 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button disabled={busy} className="btn-primary">
                        {busy ? 'Saving…' : submitLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
