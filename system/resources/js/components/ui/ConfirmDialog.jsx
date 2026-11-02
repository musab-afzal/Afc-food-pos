import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    busy = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    const confirmClass = tone === 'danger'
        ? 'bg-coral text-white hover:brightness-95'
        : 'bg-ink text-white hover:bg-herb';

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4" onClick={onCancel}>
            <div
                className="w-full max-w-md card-panel p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral/15 text-coral">
                        <AlertTriangle size={20} />
                    </span>
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                        {message && <p className="mt-2 text-sm leading-6 text-ink/55">{message}</p>}
                    </div>
                </div>
                <div className="mt-7 flex justify-end gap-3">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onCancel}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink/60 hover:bg-ink/5"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onConfirm}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${confirmClass}`}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
