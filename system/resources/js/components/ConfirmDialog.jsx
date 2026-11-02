export default function ConfirmDialog({ open, title, message, onCancel, onConfirm, busy, confirmLabel = 'Confirm' }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-secondary/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 soft-shadow">
                <h2 className="text-xl font-bold text-heading">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <button type="button" onClick={onCancel} className="btn-secondary py-3">Cancel</button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onConfirm}
                        className="rounded-[5px] bg-coral py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
