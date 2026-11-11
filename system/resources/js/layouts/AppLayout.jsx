import {
    ChevronDown, LogOut, Menu, Search, UserRound, X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { filterNavigation, navigation } from '../constants/navigation.js';

export default function AppLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout, can, isSuperAdmin, offlineSession } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState({});
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [headerSearch, setHeaderSearch] = useState('');
    const sections = useMemo(() => filterNavigation(navigation, can, isSuperAdmin), [can, isSuperAdmin, user]);

    function submitSearch(event) {
        event.preventDefault();
        const term = headerSearch.trim();
        navigate(term ? `/orders?search=${encodeURIComponent(term)}` : '/orders');
    }

    function toggleGroup(label) {
        setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
    }

    const sidebar = (
        <>
            <div className="mb-4 flex items-center justify-between border-b border-border px-4 py-4 lg:hidden">
                <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                    <span className="grid size-9 place-items-center rounded-[5px] bg-primary text-sm font-extrabold text-white">A</span>
                    <span className="text-base font-bold text-heading">AFC</span>
                </Link>
                <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-[5px] bg-light text-muted">
                    <X size={18} />
                </button>
            </div>

            <div className="mx-3 mb-4 hidden rounded-lg bg-light p-2.5 lg:flex lg:items-center lg:gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">
                    {(user?.name || 'U').slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-heading">{user?.name}</p>
                    <p className="truncate text-xs text-muted">{user?.roles?.[0] || 'Staff'}</p>
                </div>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 scrollbar-none">
                {sections.map((section) => (
                    <div key={section.label}>
                        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.08em] text-heading/70">
                            {section.label}
                        </p>
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                if (item.children) {
                                    const groupOpen = openGroups[item.label] ?? item.children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
                                    const Icon = item.icon;
                                    const groupActive = item.children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
                                    return (
                                        <div key={item.label}>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(item.label)}
                                                className={`flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2.5 text-[15px] font-medium transition ${
                                                    groupActive
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-muted hover:bg-primary/8 hover:text-primary'
                                                }`}
                                            >
                                                <Icon size={16} className={groupActive ? 'text-primary' : 'text-muted'} />
                                                <span className="flex-1 text-left">{item.label}</span>
                                                <ChevronDown size={14} className={`transition ${groupOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {groupOpen && (
                                                <div className="mt-1 space-y-0.5 border-b border-border/60 pb-2">
                                                    {item.children.map((child) => {
                                                        const active = pathname === child.to;
                                                        return (
                                                            <Link
                                                                key={child.to}
                                                                to={child.to}
                                                                onClick={() => setMobileOpen(false)}
                                                                className={`relative block rounded-[5px] py-2 pl-10 pr-3 text-sm font-medium transition ${
                                                                    active
                                                                        ? 'text-secondary before:absolute before:left-[22px] before:top-1/2 before:size-2 before:-translate-y-1/2 before:rounded-full before:bg-primary before:ring-2 before:ring-[#FFDDBB]'
                                                                        : 'text-secondary/80 hover:text-primary'
                                                                }`}
                                                            >
                                                                {child.label}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                const Icon = item.icon;
                                const active = pathname === item.to;
                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        onClick={() => setMobileOpen(false)}
                                        className={`flex items-center gap-2.5 rounded-[5px] px-3 py-2.5 text-[15px] font-medium transition ${
                                            active
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted hover:bg-primary/8 hover:text-primary'
                                        }`}
                                    >
                                        <Icon size={16} className={active ? 'text-primary' : 'text-muted'} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </>
    );

    return (
        <div className="min-h-screen bg-cream">
            {/* Top header */}
            <header className="fixed inset-x-0 top-0 z-40 flex h-[65px] items-center border-b border-border bg-white">
                <div className="flex h-full w-[252px] items-center justify-between border-r border-border px-5">
                    <Link to="/" className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-[5px] bg-primary text-sm font-extrabold text-white">A</span>
                        <span className="hidden text-lg font-extrabold text-heading sm:inline">AFC</span>
                    </Link>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 lg:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="grid size-10 place-items-center rounded-[5px] border border-border bg-light text-heading lg:hidden"
                        >
                            <Menu size={18} />
                        </button>
                        {can('orders.view') && (
                            <form
                                role="search"
                                onSubmit={submitSearch}
                                className="hidden max-w-md flex-1 items-center gap-2 rounded-[5px] border border-border bg-light px-3 md:flex"
                            >
                                <Search size={16} className="text-muted" />
                                <input
                                    value={headerSearch}
                                    onChange={(event) => setHeaderSearch(event.target.value)}
                                    className="w-full bg-transparent py-2.5 text-sm text-heading outline-none placeholder:text-muted"
                                    placeholder="Search"
                                    aria-label="Search orders"
                                />
                                <kbd className="hidden rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted lg:inline">⌘K</kbd>
                            </form>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Link to="/pos" className="btn-primary hidden sm:inline-flex">
                            Open POS
                        </Link>
                        <NotificationBell />
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen((open) => !open)}
                                className="flex items-center gap-2 rounded-[5px] border border-border bg-white px-2.5 py-1.5"
                            >
                                <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                                    {(user?.name || 'U').slice(0, 1).toUpperCase()}
                                </span>
                                <span className="hidden text-left sm:block">
                                    <span className="block text-sm font-bold leading-4 text-heading">{user?.name}</span>
                                    <span className="text-[11px] text-muted">{user?.roles?.[0] || 'Staff'}</span>
                                </span>
                                <ChevronDown size={14} className="text-muted" />
                            </button>
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-white py-2 soft-shadow">
                                    <button
                                        type="button"
                                        onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-heading hover:bg-light"
                                    >
                                        <UserRound size={16} /> Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setUserMenuOpen(false); logout(); }}
                                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-coral hover:bg-coral/5"
                                    >
                                        <LogOut size={16} /> Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Sidebar */}
            <aside className="fixed bottom-0 left-0 top-[65px] z-30 hidden w-[252px] flex-col overflow-hidden border-r border-border bg-white lg:flex">
                {sidebar}
            </aside>

            {mobileOpen && (
                <div className="fixed inset-0 z-50 bg-secondary/40 lg:hidden" onClick={() => setMobileOpen(false)}>
                    <aside
                        onClick={(event) => event.stopPropagation()}
                        className="flex h-full w-[280px] flex-col bg-white"
                    >
                        {sidebar}
                    </aside>
                </div>
            )}

            <div className="pt-[65px] lg:pl-[252px]">
                <main className="min-h-[calc(100vh-65px)] p-4 lg:p-6">
                    {(offlineSession || !navigator.onLine) && (
                        <div className="mb-4 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            You are offline. Dashboard and reports need internet — use <Link to="/pos" className="font-semibold underline">POS</Link> to keep selling. Sales will sync when you reconnect.
                        </div>
                    )}
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
