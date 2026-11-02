import { useAuth } from '../context/AuthContext.jsx';

/**
 * Render children only when the current user has the given permission
 * (or is Super Admin — handled inside AuthContext.can).
 */
export default function Can({ permission, children, fallback = null }) {
    const { can } = useAuth();
    if (!can(permission)) return fallback;
    return children;
}

export function usePermission(permission) {
    const { can } = useAuth();
    return can(permission);
}
