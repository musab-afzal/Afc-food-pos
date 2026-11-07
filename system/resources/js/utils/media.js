const appBase = (document.querySelector('meta[name="app-base"]')?.content || '').replace(/\/$/, '');

/**
 * Resolve uploaded media paths into a browser-usable URL.
 * Accepts absolute URLs, /storage/... paths, or storage-relative paths like dishes/x.jpg.
 */
export function mediaUrl(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/storage/')) return `${appBase}${raw}`;
    if (raw.startsWith('storage/')) return `${appBase}/${raw}`;
    return `${appBase}/storage/${raw.replace(/^\//, '')}`;
}
