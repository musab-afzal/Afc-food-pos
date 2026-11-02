import { Bell } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';

export default function NotificationBell() {
    const { can } = useAuth();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const ref = useRef(null);

    const load = useCallback(async () => {
        if (!can('notifications.view')) return;
        try {
            const [list, count] = await Promise.all([
                api('/notifications?per_page=8'),
                api('/notifications/unread-count'),
            ]);
            setItems(list.data || []);
            setUnread(count.data?.count ?? count.data?.unread_count ?? list.meta?.unread_count ?? 0);
        } catch {
            // ignore polling errors
        }
    }, [can]);

    useEffect(() => {
        load();
        const timer = setInterval(load, 45000);
        return () => clearInterval(timer);
    }, [load]);

    useEffect(() => {
        function onDoc(event) {
            if (ref.current && !ref.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    if (!can('notifications.view')) return null;

    async function markAll() {
        try {
            await api('/notifications/read-all', { method: 'POST', body: '{}' });
            setUnread(0);
            setItems((rows) => rows.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() })));
        } catch {
            // ignore
        }
    }

    async function openItem(item) {
        if (!item.read_at) {
            try {
                await api(`/notifications/${item.id}/read`, { method: 'POST', body: '{}' });
                setUnread((n) => Math.max(0, n - 1));
                setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)));
            } catch {
                // ignore
            }
        }
        setOpen(false);
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => { setOpen((v) => !v); if (!open) load(); }}
                className="relative grid size-10 place-items-center rounded-[5px] border border-border bg-light text-muted"
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-white soft-shadow sm:w-96">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-sm font-bold text-heading">Notifications</p>
                        {unread > 0 && (
                            <button type="button" onClick={markAll} className="text-xs font-bold text-primary">Mark all read</button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {items.length ? items.map((item) => {
                            const body = (
                                <div className={`px-4 py-3 text-sm hover:bg-light ${item.read_at ? '' : 'bg-primary-soft/60'}`}>
                                    <p className="font-semibold text-heading">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-muted line-clamp-2">{item.message}</p>
                                    <p className="mt-1 text-[11px] text-muted">{formatDateTime(item.created_at)}</p>
                                </div>
                            );
                            return item.link ? (
                                <Link key={item.id} to={item.link} onClick={() => openItem(item)}>{body}</Link>
                            ) : (
                                <button key={item.id} type="button" className="block w-full text-left" onClick={() => openItem(item)}>{body}</button>
                            );
                        }) : (
                            <p className="px-4 py-10 text-center text-sm text-muted">No notifications yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
