import {
    AlertCircle, ArrowLeft, Bike, Check, CheckCircle2, ChefHat, ClipboardList, Clock3, ConciergeBell,
    FileText, History, Maximize, MessageSquareText, Minimize, PlayCircle, RefreshCw, ShoppingBag, Sun,
    Moon, Sunrise, Utensils, UtensilsCrossed, Volume2, VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const statusColumns = [
    {
        key: 'new', label: 'New', hint: 'Waiting for acceptance', action: 'accept', actionLabel: 'Accept Order',
        HeaderIcon: ClipboardList, ActionIcon: CheckCircle2,
        header: 'bg-[#FE9F43]', body: 'bg-[#FFF1E3]', accent: 'text-[#F47B20]', soft: 'bg-[#FFEDDC] text-[#E8711A]',
        button: 'bg-[#FE9F43] hover:bg-[#FD8510]',
    },
    {
        key: 'accepted', label: 'Accepted', hint: 'Confirmed, ready to prepare', action: 'preparing', actionLabel: 'Start Preparing',
        HeaderIcon: CheckCircle2, ActionIcon: PlayCircle,
        header: 'bg-[#0B2D4F]', body: 'bg-[#EEF1F6]', accent: 'text-[#155EEF]', soft: 'bg-[#E3EBFA] text-[#1D4E9E]',
        button: 'bg-[#0B2D4F] hover:bg-[#071F38]',
    },
    {
        key: 'preparing', label: 'Preparing', hint: 'In the kitchen', action: 'ready', actionLabel: 'Mark Ready',
        HeaderIcon: ChefHat, ActionIcon: CheckCircle2,
        header: 'bg-[#13968A]', body: 'bg-[#E8F5F3]', accent: 'text-[#F47B20]', soft: 'bg-[#D7F0EC] text-[#0F7A70]',
        button: 'bg-[#2BB5A6] hover:bg-[#21A194]',
    },
    {
        key: 'ready', label: 'Ready', hint: 'Ready to serve', action: 'complete', actionLabel: 'Complete Order',
        HeaderIcon: CheckCircle2, ActionIcon: ConciergeBell,
        header: 'bg-[#0E8A5F]', body: 'bg-[#E9F5EF]', accent: 'text-[#F47B20]', soft: 'bg-[#D8F0E5] text-[#0E7A54]',
        button: 'bg-[#0E8A5F] hover:bg-[#0B7550]',
    },
];

const orderTypes = {
    dine_in: { label: 'Dine In', Icon: UtensilsCrossed, className: 'bg-[#FFE6D2] text-[#E8611A]' },
    takeaway: { label: 'Takeaway', Icon: ShoppingBag, className: 'bg-[#D7F0EC] text-[#0F7A70]' },
    delivery: { label: 'Delivery', Icon: Bike, className: 'bg-[#DCE7FB] text-[#1D4E9E]' },
};

function elapsedMinutes(seconds) {
    return Math.floor(Math.max(0, Number(seconds) || 0) / 60);
}

function shiftFor(date) {
    const h = date.getHours();
    if (h >= 6 && h < 10) return { label: 'Breakfast Shift', range: '6:00 AM – 10:00 AM', Icon: Sunrise };
    if (h >= 10 && h < 16) return { label: 'Lunch Shift', range: '10:00 AM – 4:00 PM', Icon: Sun };
    if (h >= 16 && h < 23) return { label: 'Dinner Shift', range: '4:00 PM – 11:00 PM', Icon: Moon };
    return { label: 'Night Shift', range: '11:00 PM – 6:00 AM', Icon: Moon };
}

function StatCard({ icon: Icon, label, value, iconClass }) {
    return (
        <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
            <span className={`grid size-14 shrink-0 place-items-center rounded-xl ${iconClass}`}><Icon size={26} /></span>
            <div>
                <p className="text-sm text-[#212B36]/80">{label}</p>
                <p className="text-2xl font-bold text-[#0B2D4F]">{value}</p>
            </div>
        </div>
    );
}

function TicketCard({ ticket, column, canAct, busy, onAction, onBumpItem }) {
    const order = ticket.order || {};
    const type = orderTypes[order.order_type] || { label: order.order_type?.replace(/_/g, ' ') || 'Order', Icon: Utensils, className: 'bg-gray-100 text-gray-600' };
    const items = ticket.items || [];
    const itemCount = items.reduce((sum, item) => sum + Number((item.order_item || item.orderItem)?.quantity || 1), 0);
    const minutes = elapsedMinutes(ticket.elapsed_seconds);
    const timeClass = ticket.alert_level === 'delayed' ? 'text-[#E5372B]' : ticket.alert_level === 'warning' ? 'text-[#F47B20]' : column.accent;

    return (
        <article className={`rounded-2xl bg-white p-5 shadow-sm ${ticket.alert_level === 'delayed' ? 'ring-2 ring-[#E5372B]/40' : ''}`}>
            <div className="flex items-center gap-3">
                <p className="text-2xl font-bold text-[#0B2D4F]">#{ticket.ticket_number}</p>
                <span className={`flex items-center gap-1 text-base font-semibold ${timeClass}`}>
                    <Clock3 size={17} /> {minutes} min
                </span>
                {ticket.alert_level !== 'normal' && (
                    <span className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${ticket.alert_level === 'delayed' ? 'bg-[#FDE3E1] text-[#E5372B]' : 'bg-[#FFEDDC] text-[#E8711A]'}`}>
                        <AlertCircle size={12} /> {ticket.alert_level === 'delayed' ? 'High priority' : 'Running late'}
                    </span>
                )}
            </div>

            <div className="mt-3 flex items-center gap-3 border-b border-[#E6EAED] pb-3 text-sm">
                <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${type.className}`}>
                    <type.Icon size={16} /> {type.label}
                </span>
                <span className="truncate font-semibold text-[#212B36]">
                    {order.table?.name || (order.order_number ? `Order #${order.order_number}` : order.customer?.name || '')}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[#646B72]">
                    <Utensils size={16} /> {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
            </div>

            <ul className="mt-3 space-y-2">
                {items.map((item) => {
                    const line = item.order_item || item.orderItem;
                    const detail = [line?.variant_name, ...(line?.addons || []).map((a) => a.name)].filter(Boolean).join(', ');
                    return (
                        <li key={item.id} className="group flex items-start gap-4 text-[15px] text-[#212B36]">
                            <span className="w-4 shrink-0 font-medium">{line?.quantity || 1}</span>
                            <div className={`min-w-0 flex-1 ${item.status === 'ready' ? 'text-[#646B72] line-through' : ''}`}>
                                <p>{line?.dish_name || 'Item'}</p>
                                {detail && <p className="text-xs text-[#646B72] no-underline">{detail}</p>}
                                {line?.notes && <p className="text-xs text-[#E8711A]">{line.notes}</p>}
                            </div>
                            {item.status === 'ready' ? (
                                <Check size={16} className="mt-0.5 text-[#0E8A5F]" />
                            ) : canAct && (
                                <button
                                    type="button"
                                    onClick={() => onBumpItem(item, item.status === 'pending' ? 'preparing' : 'ready')}
                                    className="rounded-md border border-[#E6EAED] px-2 py-0.5 text-[11px] font-semibold text-[#646B72] hover:bg-[#F9FAFB]"
                                >
                                    {item.status === 'pending' ? 'Prep' : 'Ready'}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {order.notes && (
                <p className={`mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${column.key === 'new' ? 'bg-[#FFF1E3] text-[#646B72]' : 'bg-[#EEF1F6] text-[#3B4A5C]'}`}>
                    <MessageSquareText size={17} className={column.key === 'new' ? 'text-[#E8711A]' : 'text-[#0B2D4F]'} /> {order.notes}
                </p>
            )}

            {canAct && column.action && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAction(ticket, column.action)}
                    className={`mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl py-3 text-base font-semibold text-white transition disabled:opacity-50 ${column.button}`}
                >
                    <column.ActionIcon size={20} /> {column.actionLabel}
                </button>
            )}
        </article>
    );
}

export default function KitchenDisplayPage() {
    const { can } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [settings, setSettings] = useState({ auto_refresh: 10, sound_notification: true, warning_minutes: 10, delay_minutes: 20 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [soundOn, setSoundOn] = useState(true);
    const [now, setNow] = useState(() => new Date());
    const [fullscreen, setFullscreen] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const knownIds = useRef(new Set());
    const audioCtx = useRef(null);

    const playChime = useCallback(() => {
        if (!soundOn) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (!audioCtx.current) audioCtx.current = new Ctx();
            const ctx = audioCtx.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.value = 0.05;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
        } catch {
            /* ignore audio failures */
        }
    }, [soundOn]);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Settings first: when the kitchen module is disabled we skip the ticket request entirely.
            const conf = await api('/kitchen/settings').catch(() => ({ data: null }));
            const enabledRaw = conf?.data ? (conf.data.enabled ?? conf.data['kitchen.enabled']) : undefined;
            const isEnabled = enabledRaw === undefined || enabledRaw === null
                ? true
                : !(enabledRaw === false || enabledRaw === 0 || enabledRaw === '0' || enabledRaw === 'false');
            setDisabled(!isEnabled);
            if (!isEnabled) {
                knownIds.current = new Set();
                setTickets([]);
                setError('');
                return;
            }

            const board = await api('/kitchen/tickets');
            const rows = board.data || [];
            const incoming = rows.filter((t) => t.status === 'new' && !knownIds.current.has(t.id));
            if (knownIds.current.size && incoming.length) playChime();
            knownIds.current = new Set(rows.map((t) => t.id));
            setTickets(rows);
            if (conf?.data) {
                setSettings((s) => ({
                    ...s,
                    auto_refresh: Number(conf.data.auto_refresh ?? conf.data['kitchen.auto_refresh'] ?? s.auto_refresh),
                    sound_notification: Boolean(conf.data.sound_notification ?? conf.data['kitchen.sound_notification'] ?? s.sound_notification),
                    warning_minutes: Number(conf.data.warning_minutes ?? conf.data['kitchen.warning_minutes'] ?? s.warning_minutes),
                    delay_minutes: Number(conf.data.delay_minutes ?? conf.data['kitchen.delay_minutes'] ?? s.delay_minutes),
                }));
            }
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [playChime]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        // When disabled, only re-check the setting once a minute instead of polling tickets.
        const ms = disabled ? 60000 : Math.max(5, Number(settings.auto_refresh) || 10) * 1000;
        const timer = setInterval(() => load({ silent: true }), ms);
        return () => clearInterval(timer);
    }, [load, settings.auto_refresh, disabled]);

    useEffect(() => {
        setSoundOn(Boolean(settings.sound_notification));
    }, [settings.sound_notification]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onFullscreen);
        return () => {
            clearInterval(timer);
            document.removeEventListener('fullscreenchange', onFullscreen);
        };
    }, []);

    const grouped = useMemo(() => {
        const map = Object.fromEntries(statusColumns.map((c) => [c.key, []]));
        tickets.forEach((ticket) => {
            if (map[ticket.status]) map[ticket.status].push(ticket);
        });
        return map;
    }, [tickets]);

    const avgPrepMinutes = useMemo(() => {
        if (!tickets.length) return 0;
        const total = tickets.reduce((sum, t) => sum + (Number(t.elapsed_seconds) || 0), 0);
        return Math.round(total / tickets.length / 60);
    }, [tickets]);

    async function runAction(ticket, action) {
        setBusyId(ticket.id);
        try {
            await api(`/kitchen/tickets/${ticket.id}/${action}`, { method: 'POST', body: '{}' });
            await load({ silent: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function bumpItem(item, status) {
        try {
            await api(`/kitchen/ticket-items/${item.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            await load({ silent: true });
        } catch (err) {
            setError(err.message);
        }
    }

    function toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.();
    }

    const canAct = can('kitchen.accept') || can('kitchen.ready') || can('kitchen.complete') || can('orders.update');
    const shift = shiftFor(now);
    const headerButton = 'grid size-11 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20';

    if (disabled) {
        return (
            <main className="grid h-screen place-items-center bg-[#F2F4F7] p-6">
                <div className="max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
                    <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#EEF1F6] text-[#0B2D4F]"><ChefHat size={32} /></span>
                    <h1 className="mt-5 text-xl font-bold text-[#0B2D4F]">Kitchen display is disabled in settings. POS-only mode.</h1>
                    <p className="mt-2 text-sm text-[#646B72]">Enable the kitchen module under Settings → Kitchen to use this screen.</p>
                    <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B2D4F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#071F38]">
                        <ArrowLeft size={16} /> Back
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="flex h-screen flex-col overflow-hidden bg-[#F2F4F7]">
            <header className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 bg-[#0B2D4F] px-6 py-3 text-white">
                <div className="flex items-center gap-3">
                    <Link to="/" className={headerButton} title="Back"><ArrowLeft size={18} /></Link>
                    <span className="grid size-11 place-items-center rounded-xl bg-[#FE9F43]"><ChefHat size={24} /></span>
                    <div>
                        <p className="text-xl font-bold leading-tight">Kitchen <span className="text-[#FE9F43]">Display</span></p>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">Live order board</p>
                    </div>
                </div>
                <div className="hidden border-l border-white/15 pl-8 sm:block">
                    <p className="text-sm text-white/80">{format(now, 'EEE, d MMM yyyy')}</p>
                    <p className="text-2xl font-bold leading-tight">{format(now, 'hh:mm a')}</p>
                </div>
                <div className="hidden items-center gap-3 border-l border-white/15 pl-8 md:flex">
                    <shift.Icon size={30} className="text-[#FE9F43]" />
                    <div>
                        <p className="font-semibold">{shift.label}</p>
                        <p className="text-sm text-white/70">{shift.range}</p>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2.5">
                    <button type="button" onClick={() => setSoundOn((v) => !v)} className={headerButton} title={soundOn ? 'Mute' : 'Unmute'}>
                        {soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
                    </button>
                    <button type="button" onClick={() => load()} className={headerButton} title="Refresh">
                        <RefreshCw size={19} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Link to="/kitchen/history" className={headerButton} title="History"><History size={19} /></Link>
                    <button type="button" onClick={toggleFullscreen} className={headerButton} title="Fullscreen">
                        {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
                    </button>
                </div>
            </header>

            {error && (
                <button type="button" onClick={() => load()} className="w-full shrink-0 bg-[#FDE3E1] px-6 py-3 text-left text-sm text-[#E5372B]">
                    {error} — tap to retry
                </button>
            )}

            <div className="grid shrink-0 grid-cols-2 gap-4 px-4 pt-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon={FileText} label="Total Orders" value={tickets.length} iconClass="bg-[#F47B20] text-white" />
                <StatCard icon={FileText} label="New Orders" value={grouped.new.length} iconClass="bg-[#FDB54E] text-white" />
                <StatCard icon={ChefHat} label="Preparing" value={grouped.preparing.length} iconClass="bg-[#0B2D4F] text-white" />
                <StatCard icon={Check} label="Ready" value={grouped.ready.length} iconClass="bg-[#13968A] text-white" />
                <StatCard icon={Clock3} label="Avg Prep Time" value={`${avgPrepMinutes} min`} iconClass="bg-[#EEF1F6] text-[#0B2D4F]" />
            </div>

            {/* Single scroll container for the whole board — columns just stack their cards. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                {statusColumns.map((column) => (
                    <section key={column.key} className={`flex min-h-[50vh] flex-col rounded-2xl ${column.body}`}>
                        <div className={`flex items-center gap-3 rounded-t-2xl px-5 py-4 text-white ${column.header}`}>
                            <column.HeaderIcon size={26} />
                            <h2 className="text-xl font-bold">{column.label} <span className="font-semibold">({grouped[column.key].length})</span></h2>
                            <span className="ml-auto text-right text-xs text-white/85">{column.hint}</span>
                        </div>
                        <div className="flex-1 space-y-3 p-3">
                            {grouped[column.key].map((ticket) => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    column={column}
                                    canAct={canAct}
                                    busy={busyId === ticket.id}
                                    onAction={runAction}
                                    onBumpItem={bumpItem}
                                />
                            ))}
                            {!grouped[column.key].length && (
                                <div className="grid h-40 place-items-center rounded-2xl border-2 border-dashed border-[#0B2D4F]/10 text-sm text-[#646B72]">
                                    No orders
                                </div>
                            )}
                        </div>
                    </section>
                ))}
                </div>
            </div>
        </main>
    );
}
