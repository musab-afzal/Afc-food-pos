import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SuperAdminRoute({ children }) {
    const { user, loading, isSuperAdmin } = useAuth();

    if (loading) {
        return <div className="grid min-h-[40vh] place-items-center text-muted">Loading…</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!isSuperAdmin) {
        return (
            <div className="mx-auto max-w-lg rounded-lg border border-border bg-white p-10 text-center soft-shadow">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-coral">403</p>
                <h1 className="mt-3 text-2xl font-extrabold text-heading">Access Denied</h1>
                <p className="mt-2 text-sm text-muted">
                    Only Super Admin can manage roles and permissions.
                </p>
                <a href="/" className="btn-primary mt-6 inline-flex">
                    Back to dashboard
                </a>
            </div>
        );
    }

    return children;
}
