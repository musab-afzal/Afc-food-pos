import { api } from '../../../services/api.js';

export const roleApi = {
    list: (params = '') => api(`/admin/roles${params ? `?${params}` : ''}`),
    get: (id) => api(`/admin/roles/${id}`),
    create: (body) => api('/admin/roles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => api(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => api(`/admin/roles/${id}`, { method: 'DELETE' }),
    clone: (id, body) => api(`/admin/roles/${id}/clone`, { method: 'POST', body: JSON.stringify(body) }),
    syncPermissions: (id, permission_ids) => api(`/admin/roles/${id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permission_ids }),
    }),
    setStatus: (id, is_active) => api(`/admin/roles/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active }),
    }),
    users: (id) => api(`/admin/roles/${id}/users`),
    activity: (id) => api(`/admin/roles/${id}/activity`),
    permissions: (params = '') => api(`/admin/permissions${params ? `?${params}` : ''}`),
    userAccess: (params = '') => api(`/admin/user-access${params ? `?${params}` : ''}`),
    assignRole: (userId, body) => api(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify(body),
    }),
    setUserStatus: (userId, status) => api(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    }),
    effectivePermissions: (userId) => api(`/admin/users/${userId}/effective-permissions`),
};
