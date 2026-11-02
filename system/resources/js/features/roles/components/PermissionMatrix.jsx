import { useMemo, useState } from 'react';
import { dependentsOf, withDependencies } from '../permissionDeps.js';

export default function PermissionMatrix({
    permissions = [],
    selectedIds = [],
    onChange,
    readOnly = false,
}) {
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState({});

    const idBySlug = useMemo(() => Object.fromEntries(permissions.map((p) => [p.slug, p.id])), [permissions]);
    const slugById = useMemo(() => Object.fromEntries(permissions.map((p) => [p.id, p.slug])), [permissions]);
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const map = {};
        for (const permission of permissions) {
            const hay = `${permission.module} ${permission.name} ${permission.slug}`.toLowerCase();
            if (q && !hay.includes(q)) continue;
            const module = permission.module || 'General';
            map[module] = map[module] || [];
            map[module].push(permission);
        }
        return map;
    }, [permissions, query]);

    const modules = Object.keys(grouped).sort();

    function setSelected(nextIds) {
        onChange?.(nextIds);
    }

    function toggleOne(permission) {
        if (readOnly) return;
        const slug = permission.slug;
        const next = new Set(selectedIds);
        if (next.has(permission.id)) {
            next.delete(permission.id);
            for (const dep of dependentsOf(slug)) {
                const id = idBySlug[dep];
                if (id) next.delete(id);
            }
            setSelected([...next]);
            return;
        }
        next.add(permission.id);
        const withDeps = withDependencies(
            [...next].map((id) => slugById[id]).filter(Boolean),
            slugById,
            idBySlug,
        );
        setSelected(withDeps);
    }

    function toggleModule(moduleItems, selectAll) {
        if (readOnly) return;
        const next = new Set(selectedIds);
        for (const item of moduleItems) {
            if (selectAll) next.add(item.id);
            else next.delete(item.id);
        }
        if (selectAll) {
            setSelected(withDependencies([...next].map((id) => slugById[id]).filter(Boolean), slugById, idBySlug));
        } else {
            setSelected([...next]);
        }
    }

    function selectAll() {
        if (readOnly) return;
        setSelected(permissions.map((p) => p.id));
    }

    function clearAll() {
        if (readOnly) return;
        setSelected([]);
    }

    function expandAll(open) {
        const state = {};
        for (const module of modules) state[module] = open;
        setExpanded(state);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    className="field max-w-sm flex-1"
                    placeholder="Search modules or permissions…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="button" className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold" onClick={() => expandAll(true)}>Expand all</button>
                <button type="button" className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold" onClick={() => expandAll(false)}>Collapse all</button>
                {!readOnly && (
                    <>
                        <button type="button" className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white" onClick={selectAll}>Select all</button>
                        <button type="button" className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold" onClick={clearAll}>Clear all</button>
                    </>
                )}
                <span className="ml-auto text-xs text-ink/45">{selectedIds.length} selected</span>
            </div>

            {readOnly && (
                <p className="rounded-2xl bg-herb/10 px-4 py-3 text-sm text-herb">
                    Super Admin has unrestricted system access. Permission checkboxes are read-only.
                </p>
            )}

            <div className="space-y-3">
                {modules.map((module) => {
                    const items = grouped[module];
                    const selectedCount = items.filter((i) => selectedSet.has(i.id)).length;
                    const all = selectedCount === items.length && items.length > 0;
                    const some = selectedCount > 0 && !all;
                    const open = expanded[module] ?? true;

                    return (
                        <article key={module} className="overflow-hidden rounded-2xl border border-ink/8 bg-white">
                            <div className="flex items-center gap-3 border-b border-ink/5 px-4 py-3">
                                <input
                                    type="checkbox"
                                    disabled={readOnly}
                                    checked={all}
                                    ref={(el) => { if (el) el.indeterminate = some; }}
                                    onChange={() => toggleModule(items, !all)}
                                />
                                <button type="button" className="flex flex-1 items-center justify-between text-left" onClick={() => setExpanded((c) => ({ ...c, [module]: !open }))}>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[.16em] text-herb">{module}</p>
                                        <p className="text-xs text-ink/40">{selectedCount} / {items.length} permissions · Full module access</p>
                                    </div>
                                    <span className="text-ink/35">{open ? '−' : '+'}</span>
                                </button>
                            </div>
                            {open && (
                                <div className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {items.map((permission) => (
                                        <label key={permission.id} className={`flex items-start gap-2 rounded-xl px-2 py-2 text-sm ${readOnly ? 'opacity-80' : 'hover:bg-ink/[.03]'}`}>
                                            <input
                                                type="checkbox"
                                                className="mt-0.5"
                                                disabled={readOnly}
                                                checked={selectedSet.has(permission.id)}
                                                onChange={() => toggleOne(permission)}
                                            />
                                            <span>
                                                <span className="font-medium">{permission.name}</span>
                                                <span className="mt-0.5 block text-[11px] text-ink/35">{permission.slug}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </article>
                    );
                })}
                {modules.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/45">No permissions match your search.</p>
                )}
            </div>
        </div>
    );
}
