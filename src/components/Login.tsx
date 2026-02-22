import React from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { loginWithGoogle } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100">
                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3 transform transition-transform hover:rotate-0">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-extrabold text-blue-900 mb-2">Lesson Planner</h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    Create professional 20-day modules from your PDFs in seconds.
                </p>
                <button
                    onClick={loginWithGoogle}
                    className="w-full py-4 px-6 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 hover:shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.172-1.228 1.228-3.14 2.56-6.432 2.56-5.116 0-9.28-4.14-9.28-9.28s4.164-9.28 9.28-9.28c2.796 0 4.92 1.108 6.42 2.52l2.316-2.316c-1.92-1.8-4.704-3.192-8.736-3.192-7.332 0-13.32 5.988-13.32 13.32s5.988 13.32 13.32 13.32c4.032 0 7.08-1.344 9.42-3.792 2.436-2.436 3.204-5.856 3.204-8.628 0-.828-.068-1.632-.192-2.376h-12.432z" />
                    </svg>
                    Sign in with Google
                </button>
                <div className="mt-8 text-xs text-gray-400">
                    Empowering UK English Teachers with Gemini AI
                </div>
            </div>
        </div>
    );
};

export default Login;
