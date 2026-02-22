import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isLogin) {
                await loginWithEmail(email, password);
            } else {
                if (!name) throw new Error("Please enter your name");
                await signupWithEmail(email, password, name);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] px-4">
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-gray-50">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 transform transition-transform hover:rotate-0">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>

                <h1 className="text-3xl font-black text-center text-blue-900 mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                <p className="text-gray-400 text-center mb-8 font-medium">
                    {isLogin ? 'Sign in to manage your English classes' : 'Start generating professional lesson plans today'}
                </p>

                {error && (
                    <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold border border-red-100 flex items-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <input
                                type="text"
                                placeholder="Your Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400 font-bold transition-all"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400 font-bold transition-all"
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400 font-bold transition-all"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-6 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase font-black text-gray-300 bg-white px-4">
                        Or continue with
                    </div>
                </div>

                <button
                    onClick={() => loginWithGoogle().catch(err => setError(err.message))}
                    className="w-full py-4 px-6 rounded-2xl bg-white border border-gray-100 text-gray-600 font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.172-1.228 1.228-3.14 2.56-6.432 2.56-5.116 0-9.28-4.14-9.28-9.28s4.164-9.28 9.28-9.28c2.796 0 4.92 1.108 6.42 2.52l2.316-2.316c-1.92-1.8-4.704-3.192-8.736-3.192-7.332 0-13.32 5.988-13.32 13.32s5.988 13.32 13.32 13.32c4.032 0 7.08-1.344 9.42-3.792 2.436-2.436 3.204-5.856 3.204-8.628 0-.828-.068-1.632-.192-2.376h-12.432z" />
                    </svg>
                    Google
                </button>

                <p className="mt-8 text-center text-sm font-bold text-gray-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-600 hover:underline"
                    >
                        {isLogin ? 'Create one' : 'Sign in'}
                    </button>
                </p>
            </div>
            <div className="mt-8 text-xs font-bold text-gray-300 uppercase tracking-widest">
                Triple-AI English Tutor Planner
            </div>
        </div>
    );
};

export default Login;
