const appBase = (document.querySelector('meta[name="app-base"]')?.content || '').replace(/\/$/, '');
const apiBase = `${appBase}/api/v1`;

export function isNetworkError(error) {
    if (!error) return false;
    if (error.offline || error.status === 0) return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('load failed')
        || message.includes('network request failed');
}

export async function api(path, options = {}) {
    const token = localStorage.getItem('respos_token');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${apiBase}${path}`, {
            ...options,
            headers,
        });
    } catch (error) {
        const offline = new Error('You are offline. This action needs an internet connection.');
        offline.status = 0;
        offline.offline = true;
        offline.cause = error;
        throw offline;
    }

    const body = await response.json().catch(() => ({ success: false, message: 'The server returned an invalid response.' }));
    if (!response.ok) {
        const error = new Error(body.message || Object.values(body.errors || {}).flat()[0] || 'Request failed.');
        error.status = response.status;
        error.errors = body.errors;
        throw error;
    }
    return body;
}

export const apiUrl = (path) => `${apiBase}${path}`;
