export default function Pagination({ meta, onPage }) {
    if (!meta || meta.last_page <= 1) return null;
    return <div className="mt-4 flex items-center justify-between text-sm"><p className="text-ink/45">Showing {meta.from || 0}–{meta.to || 0} of {meta.total}</p><div className="flex gap-2"><button disabled={meta.current_page === 1} onClick={() => onPage(meta.current_page - 1)} className="rounded-xl border border-ink/10 bg-white px-4 py-2 disabled:opacity-35">Previous</button><button disabled={meta.current_page === meta.last_page} onClick={() => onPage(meta.current_page + 1)} className="rounded-xl border border-ink/10 bg-white px-4 py-2 disabled:opacity-35">Next</button></div></div>;
}
