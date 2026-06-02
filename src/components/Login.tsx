import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword } = useAuth();
    const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);

    const scrollToForm = (targetView: 'login' | 'signup') => {
        setView(targetView);
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);
        try {
            if (view === 'login') {
                await loginWithEmail(email, password);
            } else if (view === 'signup') {
                if (!name.trim()) throw new Error('Please enter your full name');
                await signupWithEmail(email, password, name);
            } else {
                await resetPassword(email);
                setMessage('Password reset email sent! Check your inbox.');
            }
        } catch (err: any) {
            const msg = err.message?.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim();
            setError(msg || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const titles = {
        login: 'Welcome back 👋',
        signup: 'Create your account',
        forgot: 'Reset password',
    };
    const subtitles = {
        login: 'Sign in to manage your lesson plans',
        signup: 'Start generating AI lesson plans today',
        forgot: 'Enter your email to receive a reset link',
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">

            {/* ── LEFT PANEL — Her photo hero ── */}
            <div className="relative lg:w-[52%] flex-shrink-0 overflow-hidden"
                style={{ minHeight: '420px' }}>

                {/* The photo — covers the entire panel */}
                <img
                    src="/app-icon-source.jpg"
                    alt="Queen's Classes"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                />

                {/* Gradient overlay — dark at bottom for text legibility, subtle everywhere else */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-blue-950/20" />
                {/* Subtle left-side vignette for desktop blending */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-950/10 hidden lg:block" />

                {/* Bottom branding text */}
                <div className="absolute bottom-0 left-0 right-0 z-10 p-8 lg:p-12">
                    <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-3 drop-shadow-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Teach with Purpose.<br />
                        <span className="text-blue-300">Inspire Every Day.</span>
                    </h1>
                    <p className="text-blue-100/80 text-base lg:text-lg leading-relaxed max-w-sm mb-6">
                        AI-powered lesson plans, student tracking, and daily sparks.
                    </p>

                    {/* Mobile CTA buttons — only visible on small screens */}
                    <div className="flex gap-3 lg:hidden">
                        <button
                            onClick={() => scrollToForm('login')}
                            className="flex-1 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-lg hover:bg-blue-50 transition-all active:scale-95"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => scrollToForm('signup')}
                            className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all active:scale-95"
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Desktop footer credit */}
                    <p className="hidden lg:block text-blue-300/40 text-xs font-medium mt-6">
                        Queen Osewime
                    </p>
                </div>
            </div>

            {/* ── RIGHT PANEL — Form ── */}
            <div
                ref={formRef}
                className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-white min-h-screen lg:min-h-0 scroll-mt-0"
            >
                <div className="w-full max-w-md">

                    {/* View switcher tabs — desktop */}
                    {view !== 'forgot' && (
                        <div className="hidden lg:flex gap-1 bg-slate-100 p-1 rounded-xl mb-8">
                            <button
                                onClick={() => { setView('login'); setError(null); }}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${view === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => { setView('signup'); setError(null); }}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${view === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Create Account
                            </button>
                        </div>
                    )}

                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            {titles[view]}
                        </h2>
                        <p className="text-slate-500 text-sm">{subtitles[view]}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 flex items-start gap-3">
                            <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-50 text-green-700 p-4 rounded-2xl mb-6 text-sm font-medium border border-green-100 flex items-center gap-3">
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {view === 'signup' && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Samuel Alalade"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                required
                            />
                        </div>

                        {view !== 'forgot' && (
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                                    {view === 'login' && (
                                        <button type="button" onClick={() => setView('forgot')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {loading ? 'Processing...' : view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send Reset Link'}
                        </button>

                        {view === 'forgot' && (
                            <button type="button" onClick={() => setView('login')} className="w-full py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
                                ← Back to sign in
                            </button>
                        )}
                    </form>

                    {view !== 'forgot' && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-white px-4 text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
                                </div>
                            </div>

                            <button
                                onClick={() => loginWithGoogle().catch(err => {
                                    const msg = err.message?.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim();
                                    setError(msg || 'Google sign-in failed.');
                                })}
                                className="w-full py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>
                        </>
                    )}

                    {/* Mobile: switch between login/signup */}
                    <p className="mt-8 text-center text-sm text-slate-500 lg:hidden">
                        {view === 'login' ? "Don't have an account? " : view === 'signup' ? 'Already have an account? ' : ''}
                        {view !== 'forgot' && (
                            <button
                                onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }}
                                className="font-semibold text-blue-600 hover:text-blue-700"
                            >
                                {view === 'login' ? 'Sign up' : 'Sign in'}
                            </button>
                        )}
                    </p>


                </div>
            </div>
        </div>
    );
};

export default Login;
