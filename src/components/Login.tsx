import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const features = [
    { icon: '🤖', label: 'AI-Powered', desc: 'Generate full lesson plans from your syllabus in seconds' },
    { icon: '📋', label: 'Structured Plans', desc: 'Summary, deep-dive content, activities and quiz per lesson' },
    { icon: '✅', label: 'Track Progress', desc: 'Mark lessons complete and monitor your student\'s journey' },
];

const Login: React.FC = () => {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword } = useAuth();
    const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
            // Clean up Firebase error messages
            const msg = err.message?.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim();
            setError(msg || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const titles = {
        login: 'Welcome back',
        signup: 'Create account',
        forgot: 'Reset password',
    };
    const subtitles = {
        login: 'Sign in to manage your lesson plans',
        signup: 'Start generating AI lesson plans today',
        forgot: 'Enter your email to receive a reset link',
    };

    return (
        <div className="min-h-screen flex">
            {/* ── Left branding panel (desktop only) ── */}
            <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-14 flex-col justify-between relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-3xl" />
                </div>

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <img src="/icon-48x48.png" alt="Queen's Classes" className="w-10 h-10 rounded-xl shrink-0 object-cover shadow-lg" />
                    <span className="text-white font-black text-xl tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Queen's Classes</span>
                </div>

                {/* Hero copy */}
                <div className="relative">
                    <h1 className="text-5xl font-black text-white leading-[1.1] mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        AI Lesson Plans<br />
                        <span className="text-blue-400">That Actually Work</span>
                    </h1>
                    <p className="text-blue-200/80 text-lg leading-relaxed mb-12 max-w-md">
                        Upload your syllabus PDF and let AI build a complete, structured lesson plan — with summaries, deep-dives, activities and quizzes.
                    </p>

                    <div className="space-y-4">
                        {features.map((f) => (
                            <div key={f.label} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                <span className="text-2xl">{f.icon}</span>
                                <div>
                                    <p className="text-white font-bold text-sm">{f.label}</p>
                                    <p className="text-blue-200/70 text-sm">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative text-blue-300/40 text-xs font-medium">
                    Powered by Groq · Gemini · GPT-4o
                </p>
            </div>

            {/* ── Right form panel ── */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white min-h-screen lg:min-h-0">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-3 mb-10">
                    <img src="/icon-48x48.png" alt="Queen's Classes" className="w-9 h-9 rounded-xl shrink-0 object-cover" />
                    <span className="text-slate-900 font-black text-xl tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Queen's Classes</span>
                </div>

                <div className="w-full max-w-md">
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

                    <p className="mt-8 text-center text-sm text-slate-500">
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
