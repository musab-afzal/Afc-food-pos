import { Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { usePos } from '../context/PosContext.jsx';

const empty = { name: '', phone: '', email: '', address: '' };

export default function QuickCustomerModal() {
    const { state, patch, createCustomer, notify } = usePos();
    const [form, setForm] = useState(empty);
    const [busy, setBusy] = useState(false);
    if (!state.customerModalOpen) return null;

    async function submit(event) {
        event.preventDefault();
        if (!form.name.trim()) {
            notify('Customer name is required.', 'error');
            return;
        }
        setBusy(true);
        try {
            await createCustomer(form);
            setForm(empty);
        } catch (error) {
            notify(error.message, 'error');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => !busy && patch({ customerModalOpen: false })}>
            <form className="w-full max-w-md card-panel p-5" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Quick add customer</h2>
                    <button type="button" disabled={busy} onClick={() => patch({ customerModalOpen: false })} className="text-ink/35"><X size={18} /></button>
                </div>
                <div className="mt-4 space-y-3">
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" />
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" />
                    <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" />
                    {state.orderType === 'delivery' && (
                        <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Delivery address" rows={2} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" />
                    )}
                </div>
                <button type="submit" disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                    Save & select
                </button>
            </form>
        </div>
    );
}
