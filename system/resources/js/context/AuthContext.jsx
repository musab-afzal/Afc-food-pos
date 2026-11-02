import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { setCurrencyConfig } from '../utils/format.js';

const AuthContext = createContext(null);

function applyCurrency(payload) {
    if (payload?.currency) setCurrencyConfig(payload.currency);
    else if (payload?.data?.currency) setCurrencyConfig(payload.data.currency);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('respos_user') || 'null'));
    const [loading, setLoading] = useState(Boolean(localStorage.getItem('respos_token')));

    const refreshUser = useCallback(async () => {
        const response = await api('/me');
        applyCurrency(response);
        setUser(response.data);
        localStorage.setItem('respos_user', JSON.stringify(response.data));
        return response.data;
    }, []);

    useEffect(() => {
        if (!localStorage.getItem('respos_token')) return;
        refreshUser()
            .catch((error) => {
                if (error.status === 401) {
                    localStorage.removeItem('respos_token');
                    localStorage.removeItem('respos_user');
                    setUser(null);
                }
            })
            .finally(() => setLoading(false));
    }, [refreshUser]);

    async function login(credentials) {
        const response = await api('/login', { method: 'POST', body: JSON.stringify(credentials) });
        applyCurrency(response.data);
        localStorage.setItem('respos_token', response.data.token);
        localStorage.setItem('respos_user', JSON.stringify(response.data.user));
        setUser(response.data.user);
    }

    async function logout() {
        try {
            await api('/logout', { method: 'POST' });
        } finally {
            localStorage.removeItem('respos_token');
            localStorage.removeItem('respos_user');
            setUser(null);
        }
    }

    const isSuperAdmin = Boolean(user?.is_super_admin);

    const value = useMemo(() => ({
        user,
        loading,
        login,
        logout,
        refreshUser,
        isSuperAdmin,
        can: (permission) => !permission || isSuperAdmin || user?.permissions?.includes(permission),
    }), [user, loading, refreshUser, isSuperAdmin]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
