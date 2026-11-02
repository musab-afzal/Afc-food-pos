import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../../../components/PageHeader.jsx';
import SearchInput from '../../../components/SearchInput.jsx';
import { roleApi } from '../services/roleApi.js';

export default function PermissionsCatalogPage() {
    const [rows, setRows] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        roleApi.permissions()
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
                description="Catalog of system permissions. Assign them through roles — role management is Super Admin only."
                breadcrumbs={['System Administration', 'Permissions']}
            />
            <div className="mb-5 max-w-md">
                <SearchInput value={query} onChange={setQuery} placeholder="Search modules or permissions…" />
            </div>
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(grouped).map(([module, items]) => (
                        <article key={module} className="card-panel p-5">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">{module}</p>
                                <span className="text-xs text-ink/40">{items.length}</span>
                            </div>
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
