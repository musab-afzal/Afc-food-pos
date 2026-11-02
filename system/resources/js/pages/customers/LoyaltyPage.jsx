import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import { api } from '../../services/api.js';

export default function LoyaltyPage() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api('/settings?group=loyalty')
            .then((response) => setSettings(response.data || {}))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const payload = Object.entries(settings).map(([key, value]) => ({
                key,
                value: typeof value === 'boolean' ? (value ? '1' : '0') : value,
                type: typeof value === 'boolean' ? 'boolean' : (typeof value === 'number' ? 'decimal' : 'string'),
                group: 'loyalty',
            }));
            await api('/settings', { method: 'PUT', body: JSON.stringify({ settings: payload }) });
            toast.success('Loyalty settings saved');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    const fields = [
        { key: 'loyalty.enabled', label: 'Enabled', type: 'boolean' },
        { key: 'loyalty.spend_amount', label: 'Spend amount for points', type: 'number' },
        { key: 'loyalty.points_earned', label: 'Points earned', type: 'number' },
        { key: 'loyalty.redemption_value', label: 'Point redemption value', type: 'number' },
        { key: 'loyalty.min_redemption', label: 'Minimum redemption', type: 'number' },
        { key: 'loyalty.max_redemption', label: 'Maximum redemption', type: 'number' },
    ];

    return (
        <div className="mx-auto max-w-2xl">
            <PageHeader
                title="Loyalty"
                description="Configure how guests earn and redeem points."
                breadcrumbs={['Customers', 'Loyalty']}
            />
            <form onSubmit={save} className="card-panel p-6">
                {loading ? (
                    <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/5" />)}</div>
                ) : (
                    <div className="space-y-5">
                        {fields.map((field) => (
                            <label key={field.key} className="block text-sm">
                                <span className="mb-2 block font-medium">{field.label}</span>
                                {field.type === 'boolean' ? (
                                    <button
                                        type="button"
                                        onClick={() => setSettings((s) => ({ ...s, [field.key]: !s[field.key] }))}
                                        className={`relative h-8 w-14 rounded-full transition ${settings[field.key] ? 'bg-herb' : 'bg-ink/15'}`}
                                    >
                                        <span className={`absolute top-1 size-6 rounded-full bg-white transition ${settings[field.key] ? 'left-7' : 'left-1'}`} />
                                    </button>
                                ) : (
                                    <input
                                        className="field"
                                        type="number"
                                        value={settings[field.key] ?? ''}
                                        onChange={(e) => setSettings((s) => ({ ...s, [field.key]: e.target.value }))}
                                    />
                                )}
                            </label>
                        ))}
                    </div>
                )}
                <button disabled={busy || loading} className="mt-7 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? 'Saving…' : 'Save loyalty rules'}
                </button>
            </form>
        </div>
    );
}
