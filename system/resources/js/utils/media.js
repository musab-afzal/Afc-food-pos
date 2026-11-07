const appBase = (document.querySelector('meta[name="app-base"]')?.content || '').replace(/\/$/, '');

/**
 * Resolve uploaded media paths into a browser-usable URL.
 * Accepts absolute URLs, /uploads|/media|/storage paths, or relative storage paths like dishes/x.jpg.
 */
export function mediaUrl(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/uploads/') || raw.startsWith('/media/')) return `${appBase}${raw}`;
    if (raw.startsWith('/storage/')) return `${appBase}/media/${raw.slice('/storage/'.length)}`;
    if (raw.startsWith('uploads/') || raw.startsWith('media/')) return `${appBase}/${raw}`;
    if (raw.startsWith('storage/')) return `${appBase}/media/${raw.slice('storage/'.length)}`;
    return `${appBase}/media/${raw.replace(/^\//, '')}`;
}
