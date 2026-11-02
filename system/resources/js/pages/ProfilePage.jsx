import { useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

export default function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const [profile, setProfile] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
    });
    const [passwords, setPasswords] = useState({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const [busy, setBusy] = useState(false);

    async function saveProfile(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/profile', { method: 'PUT', body: JSON.stringify(profile) });
            await refreshUser?.();
            toast.success('Profile updated');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function savePassword(event) {
        event.preventDefault();
        setBusy(true);
        try {
            await api('/password', { method: 'PUT', body: JSON.stringify(passwords) });
            setPasswords({ current_password: '', password: '', password_confirmation: '' });
            toast.success('Password changed. Please sign in again if prompted.');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                title="Profile"
                description="Manage your account details and password."
                breadcrumbs={['System', 'Profile']}
            />

            <form onSubmit={saveProfile} className="rounded-3xl bg-white p-6 soft-shadow">
                <h2 className="text-lg font-semibold">Account</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Full name">
                        <input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
                    </Field>
                    <Field label="Email">
                        <input className="field" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
                    </Field>
                    <Field label="Phone">
                        <input className="field" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                    </Field>
                    <Field label="Roles">
                        <input className="field bg-ink/3" value={(user?.roles || []).join(', ') || '—'} readOnly />
                    </Field>
                </div>
                <button disabled={busy} className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    Save profile
                </button>
            </form>

            <form onSubmit={savePassword} className="mt-5 rounded-3xl bg-white p-6 soft-shadow">
                <h2 className="text-lg font-semibold">Change password</h2>
                <div className="mt-5 grid gap-4">
                    <Field label="Current password">
                        <input className="field" type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} required />
                    </Field>
                    <Field label="New password">
                        <input className="field" type="password" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} required minLength={8} />
                    </Field>
                    <Field label="Confirm password">
                        <input className="field" type="password" value={passwords.password_confirmation} onChange={(e) => setPasswords({ ...passwords, password_confirmation: e.target.value })} required minLength={8} />
                    </Field>
                </div>
                <button disabled={busy} className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    Update password
                </button>
            </form>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block text-sm">
            <span className="mb-2 block font-medium text-ink/70">{label}</span>
            {children}
        </label>
    );
}
