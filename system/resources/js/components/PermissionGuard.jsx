import { useAuth } from '../context/AuthContext.jsx';

export default function PermissionGuard({ permission, permissions, any = false, fallback = null, children }) {
    const { can } = useAuth();
    const list = permissions || (permission ? [permission] : []);
    if (!list.length) return children;
    const allowed = any ? list.some((item) => can(item)) : list.every((item) => can(item));
    return allowed ? children : fallback;
}
