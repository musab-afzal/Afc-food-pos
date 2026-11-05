const appBase = (document.querySelector('meta[name="app-base"]')?.content || '').replace(/\/$/, '');
const apiBase = `${appBase}/api/v1`;

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
    const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
    });
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
