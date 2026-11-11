import { ChefHat, Eye, EyeOff, LockKeyhole, Mail, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import restaurantImage from '../../../../sites design/assets/img/authentication/aaleshan-restaurant.jpg';
import { useAuth } from '../context/AuthContext.jsx';

const displayFont = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function LoginPage() {
    const { user, login } = useAuth();
    const [form, setForm] = useState({ email: '', password: '', device_name: 'AFC browser' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    if (user) return <Navigate to="/" replace />;

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            await login(form);
        } catch (caught) {
            setError(
                caught?.offline || caught?.status === 0 || !navigator.onLine
                    ? 'You are offline. Connect to the internet to log in once, then POS can work offline.'
                    : caught.message,
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="grid min-h-dvh bg-[#f8f2e9] lg:grid-cols-[1.07fr_1fr]">
            <section className="relative isolate flex min-h-56 items-center overflow-hidden bg-[#251b13] px-8 py-12 sm:px-14 lg:min-h-dvh lg:px-[12%]">
                <img
                    src={restaurantImage}
                    alt=""
                    fetchPriority="high"
                    className="absolute inset-0 -z-20 size-full object-cover object-center"
                />
                <div className="absolute inset-0 -z-10 bg-linear-to-r from-[#160e08]/80 via-[#21150b]/55 to-[#21150b]/25" />
                <div className="flex flex-col items-start gap-5 lg:gap-7">
                    <h1 className="text-4xl font-normal leading-[1.1] tracking-tight text-[#fffaf2] sm:text-5xl xl:text-[68px]" style={displayFont}>
                        Welcome back
                    </h1>
                    <p className="max-w-sm text-lg leading-relaxed text-[#fffaf2]/90 sm:text-xl xl:text-2xl">
                        Login to manage your business
                    </p>
                    <span aria-hidden="true" className="h-[3px] w-20 rounded-full bg-[#d8a363]" />
                </div>
            </section>

            <section aria-label="Account login" className="relative isolate flex items-center justify-center overflow-hidden px-6 py-12 sm:px-12 sm:py-16 lg:px-12 xl:px-20">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,#fffdf8,transparent_65%)]" />
                <Sprout aria-hidden="true" strokeWidth={0.7} className="pointer-events-none absolute -left-14 -top-10 -z-10 size-52 rotate-135 text-[#c7b39d]/40" />
                <Sprout aria-hidden="true" strokeWidth={0.7} className="pointer-events-none absolute -bottom-12 -right-12 -z-10 size-64 -rotate-35 text-[#c7b39d]/35" />

                <div className="flex w-full max-w-[480px] flex-col gap-10 sm:gap-12">
                    <header className="flex flex-col items-center gap-3 text-center">
                        <ChefHat aria-hidden="true" size={70} strokeWidth={1.35} className="text-[#800f0b]" />
                        <div className="flex flex-col gap-3">
                            <p className="text-[40px] font-normal leading-none tracking-tight text-[#241b16] sm:text-5xl" style={displayFont}>Aaleshan</p>
                            <div className="flex items-center justify-center gap-4">
                                <span aria-hidden="true" className="h-px w-9 bg-[#b49b84]" />
                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#786452]">Food Court</p>
                                <span aria-hidden="true" className="h-px w-9 bg-[#b49b84]" />
                            </div>
                        </div>
                    </header>

                    <form onSubmit={submit} aria-busy={busy} className="flex flex-col gap-7">
                        <h2 className="text-center text-4xl font-normal text-[#241b16] sm:text-[44px]" style={displayFont}>Log In</h2>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="login-email" className="text-sm font-semibold text-[#655447]">Email address</label>
                                <div className="flex items-center gap-3 rounded-xl border border-[#cebdac] bg-white/35 px-4 transition focus-within:border-[#800f0b] focus-within:ring-2 focus-within:ring-[#800f0b]/10">
                                    <Mail aria-hidden="true" size={21} strokeWidth={1.5} className="shrink-0 text-[#786452]" />
                                    <input
                                        id="login-email"
                                        name="email"
                                        autoComplete="username"
                                        className="min-w-0 flex-1 bg-transparent py-4 text-base text-[#241b16] outline-none placeholder:text-[#958779]"
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="Enter your email address"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="login-password" className="text-sm font-semibold text-[#655447]">Password</label>
                                <div className="flex items-center gap-3 rounded-xl border border-[#cebdac] bg-white/35 px-4 transition focus-within:border-[#800f0b] focus-within:ring-2 focus-within:ring-[#800f0b]/10">
                                    <LockKeyhole aria-hidden="true" size={21} strokeWidth={1.5} className="shrink-0 text-[#786452]" />
                                    <input
                                        id="login-password"
                                        name="password"
                                        autoComplete="current-password"
                                        className="min-w-0 flex-1 bg-transparent py-4 text-base text-[#241b16] outline-none placeholder:text-[#958779]"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="-mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-[#786452] transition hover:text-[#800f0b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800f0b]"
                                    >
                                        {showPassword ? <EyeOff aria-hidden="true" size={21} strokeWidth={1.5} /> : <Eye aria-hidden="true" size={21} strokeWidth={1.5} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && <p role="alert" className="rounded-xl border border-[#800f0b]/20 bg-[#800f0b]/5 p-3 text-sm text-[#800f0b]">{error}</p>}

                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-full bg-[#800f0b] px-6 py-4 text-lg font-bold text-white shadow-[0_6px_20px_-10px_#800f0b80] transition hover:bg-[#650b08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#800f0b] disabled:cursor-wait disabled:opacity-60"
                        >
                            {busy ? 'Logging in...' : 'Log In'}
                        </button>
                    </form>

                    <footer className="border-t border-[#d8cabb] pt-6 text-center text-sm leading-6 text-[#78695c]">
                        Powered by{' '}
                        <a href="https://musabafzal.dev" target="_blank" rel="noopener noreferrer" className="rounded-sm font-bold text-[#800f0b] underline decoration-[#800f0b]/30 underline-offset-4 hover:decoration-[#800f0b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#800f0b]">Musab Afzal</a>
                        {' '}<span className="whitespace-nowrap">(musabafzal.dev)</span>
                    </footer>
                </div>
            </section>
        </main>
    );
}
