import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isNetworkError } from '../services/api.js';
import { setCurrencyConfig } from '../utils/format.js';

const AuthContext = createContext(null);

function applyCurrency(payload) {
    if (payload?.currency) setCurrencyConfig(payload.currency);
    else if (payload?.data?.currency) setCurrencyConfig(payload.data.currency);
}

function readCachedUser() {
    try {
        return JSON.parse(localStorage.getItem('respos_user') || 'null');
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => readCachedUser());
    const [loading, setLoading] = useState(Boolean(localStorage.getItem('respos_token')));
    const [offlineSession, setOfflineSession] = useState(() => Boolean(localStorage.getItem('respos_token') && !navigator.onLine));

    const refreshUser = useCallback(async () => {
        const response = await api('/me');
        applyCurrency(response);
        setUser(response.data);
        setOfflineSession(false);
        localStorage.setItem('respos_user', JSON.stringify(response.data));
        return response.data;
    }, []);

    useEffect(() => {
        if (!localStorage.getItem('respos_token')) {
            setLoading(false);
            return undefined;
        }

        // Stay signed in from cache while offline — do not call /me.
        if (!navigator.onLine) {
            setOfflineSession(true);
            setLoading(false);
            return undefined;
        }

        refreshUser()
            .catch((error) => {
                if (error.status === 401) {
                    localStorage.removeItem('respos_token');
                    localStorage.removeItem('respos_user');
                    setUser(null);
                    setOfflineSession(false);
                    return;
                }
                // Network blip: keep cached user so POS/dashboard can open offline.
                if (isNetworkError(error) && readCachedUser()) {
                    setUser(readCachedUser());
                    setOfflineSession(true);
                    return;
                }
            })
            .finally(() => setLoading(false));

        const onOnline = () => {
            setOfflineSession(false);
            refreshUser().catch(() => {});
        };
        const onOffline = () => setOfflineSession(true);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [refreshUser]);

    async function login(credentials) {
        const response = await api('/login', { method: 'POST', body: JSON.stringify(credentials) });
        applyCurrency(response.data);
        localStorage.setItem('respos_token', response.data.token);
        localStorage.setItem('respos_user', JSON.stringify(response.data.user));
        setOfflineSession(false);
        setUser(response.data.user);
    }

    async function logout() {
        try {
            if (navigator.onLine) {
                await api('/logout', { method: 'POST' });
            }
        } finally {
            localStorage.removeItem('respos_token');
            localStorage.removeItem('respos_user');
            setOfflineSession(false);
            setUser(null);
        }
    }

    const isSuperAdmin = Boolean(user?.is_super_admin);

    const value = useMemo(() => ({
        user,
        loading,
        offlineSession,
        login,
        logout,
        refreshUser,
        isSuperAdmin,
        can: (permission) => !permission || isSuperAdmin || user?.permissions?.includes(permission),
    }), [user, loading, offlineSession, refreshUser, isSuperAdmin]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
