import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function usePaginatedResource(path, filters) {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setLoading(true); setError('');
        const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();
        try { const response = await api(`${path}?${query}`); setRows(response.data); setMeta(response.meta); }
        catch (caught) { setError(caught.message); }
        finally { setLoading(false); }
    }, [path, JSON.stringify(filters)]);
    useEffect(() => { const timeout = setTimeout(load, 180); return () => clearTimeout(timeout); }, [load]);
    return { rows, meta, loading, error, reload: load };
}
