import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { api } from '../../services/api.js';

export default function PermissionsPage() {
    const [rows, setRows] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/permissions')
            .then((response) => setRows(response.data || []))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    const grouped = useMemo(() => {
        const filtered = rows.filter((row) => `${row.name} ${row.slug} ${row.module}`.toLowerCase().includes(query.toLowerCase()));
        return filtered.reduce((acc, permission) => {
            const module = permission.module || 'General';
            acc[module] = acc[module] || [];
            acc[module].push(permission);
            return acc;
        }, {});
    }, [rows, query]);

    return (
        <div>
            <PageHeader
                title="Permissions"
                description="Granular capabilities assigned through roles. APIs enforce these on every request."
                breadcrumbs={['Staff', 'Permissions']}
            />
            <div className="mb-5 max-w-md">
                <SearchInput value={query} onChange={setQuery} placeholder="Search permissions…" />
            </div>
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(grouped).map(([module, items]) => (
                        <article key={module} className="rounded-3xl bg-white p-5 soft-shadow">
                            <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">{module}</p>
                            <ul className="mt-4 space-y-2">
                                {items.map((permission) => (
                                    <li key={permission.id} className="rounded-xl bg-cream/70 px-3 py-2 text-sm">
                                        <p className="font-medium">{permission.name}</p>
                                        <p className="text-xs text-ink/40">{permission.slug}</p>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
