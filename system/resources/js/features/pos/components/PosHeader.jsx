import { ChevronDown, Cloud, CloudOff, Maximize2, Minimize2, RefreshCw, Search, Sun, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import NotificationBell from '../../../components/NotificationBell.jsx';
import { usePos } from '../context/PosContext.jsx';
import CustomerBlock from './CustomerBlock.jsx';

export default function PosHeader() {
    const { state, user, patch, searchRef, handleBarcodeEnter, can, loadRecent, syncNow } = usePos();
    const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
    const [menuOpen, setMenuOpen] = useState(false);
    const syncing = state.sync?.state === 'syncing';
    const pending = Number(state.sync?.pending || 0);

    useEffect(() => {
        const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch { /* Fullscreen may be unavailable in an embedded browser. */ }
    }

    const initials = (user?.name || 'AFC').split(' ').map((part) => part[0]).slice(0, 2).join('');
    const openedAt = state.register?.opened_at;

    return (
        <header className="afc-pos-header">
            <div className="afc-pos-search-row">
                <div className="afc-pos-search">
                    <Search size={23} aria-hidden="true" />
                    <input
                        ref={searchRef}
                        value={state.query}
                        onChange={(event) => patch({ query: event.target.value })}
                        onKeyDown={(event) => { if (event.key === 'Enter') handleBarcodeEnter(); }}
                        placeholder="Search for menu items, e.g. burger, pizza, drink..."
                        aria-label="Search menu items, SKU or barcode"
                    />
                    <kbd title="Search shortcut">Ctrl K</kbd>
                </div>
                <CustomerBlock compact />
            </div>
            <div className={`afc-pos-register ${state.online ? '' : 'is-offline'}`}>
                <Sun size={32} strokeWidth={1.6} />
                <div>
                    <strong>{state.register ? 'Register Open' : 'Current Session'}</strong>
                    <small>
                        {openedAt
                            ? `Opened ${new Date(openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : (state.online ? 'Ready to take orders' : 'Working offline — sales saved on this device')}
                        {pending > 0 ? ` · ${pending} waiting to sync` : ''}
                    </small>
                </div>
            </div>
            <button
                type="button"
                className={`afc-pos-sync-pill ${state.online ? 'is-online' : 'is-offline'} ${syncing ? 'is-syncing' : ''}`}
                onClick={() => { if (state.online) syncNow(); }}
                title={state.online ? (pending ? 'Sync offline sales now' : 'Connection OK') : 'Offline — sales will sync when internet returns'}
                disabled={syncing || !state.online}
            >
                {state.online ? <Cloud size={16} /> : <CloudOff size={16} />}
                <span>
                    {syncing ? 'Syncing…' : (state.online ? 'Online' : 'Offline')}
                    {pending ? ` · ${pending}` : ''}
                </span>
                {state.online && pending > 0 && !syncing && <RefreshCw size={14} />}
            </button>
            <div className="afc-pos-user-wrap">
                <button type="button" className="afc-pos-user" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                    <span className="afc-pos-avatar">{initials}</span>
                    <span className="afc-pos-user-name"><strong>{user?.name || 'Staff'}</strong><small>{user?.roles?.[0] || 'Cashier'}</small></span>
                    <ChevronDown size={17} />
                </button>
                {menuOpen && (
                    <>
                        <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close cashier menu" onClick={() => setMenuOpen(false)} />
                        <div className="afc-pos-user-menu">
                            <p>{state.online ? <Cloud size={16} /> : <CloudOff size={16} />}{state.online ? 'Online' : 'Offline'}{pending ? ` · ${pending} pending` : ''}</p>
                            {pending > 0 && (
                                <button
                                    type="button"
                                    disabled={!state.online || syncing}
                                    onClick={() => { setMenuOpen(false); syncNow(); }}
                                >
                                    <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync now'}
                                </button>
                            )}
                            <button type="button" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
                            {can('orders.view') && <button type="button" onClick={() => { loadRecent(); setMenuOpen(false); }}><UserRound size={16} /> Recent sales</button>}
                        </div>
                    </>
                )}
            </div>
            <NotificationBell />
        </header>
    );
}
