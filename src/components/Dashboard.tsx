import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CreateClassModal from './CreateClassModal';
import { useNavigate } from 'react-router-dom';

interface ClassData {
    id: string;
    name: string;
    teacherName: string;
    studentName?: string;
    studentCount: number;
    completedLessons: number;
    totalLessons: number;
    lessons?: any[];
}

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'classes'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ClassData[];
            setClasses(classList);
            setLoading(false);
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleDeleteClass = async (e: React.MouseEvent, classId: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this class? All lessons will be lost.")) {
            try {
                await deleteDoc(doc(db, 'classes', classId));
            } catch (err) {
                console.error("Error deleting class:", err);
            }
        }
    };

    const handleCloneClass = async (e: React.MouseEvent, cls: ClassData) => {
        e.stopPropagation();
        try {
            await addDoc(collection(db, 'classes'), {
                ...cls,
                id: undefined,
                name: `${cls.name} (Clone)`,
                completedLessons: 0,
                createdAt: serverTimestamp(),
                lessons: cls.lessons?.map(l => ({ ...l, completed: false })) || null
            });
        } catch (err) {
            console.error("Error cloning class:", err);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-blue-900 tracking-tight">Welcome, {user?.displayName?.split(' ')[0] || 'Teacher'}!</h1>
                    <p className="text-gray-500 font-medium">You have {classes.length} active class{classes.length !== 1 ? 'es' : ''}.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="bg-gray-100 p-4 rounded-2xl text-gray-400 hover:text-blue-600 hover:bg-white hover:shadow-lg transition-all active:scale-95"
                        title="Settings"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-7 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 uppercase text-sm tracking-widest"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        New Class
                    </button>
                </div>
            </header>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Settings</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Appearance</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['light', 'dark', 'glass'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTheme(t)}
                                            className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === t
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Account</h3>
                                <div className="bg-gray-50 p-4 rounded-2xl mb-4 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">
                                        {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'T'}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-bold text-sm text-gray-800 truncate">{user?.displayName || 'Tutor User'}</p>
                                        <p className="text-[10px] font-bold text-gray-400 truncate">{user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        logout();
                                    }}
                                    className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-black text-xs uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>

                        <p className="mt-8 text-center text-[10px] font-bold text-gray-200 uppercase tracking-widest">
                            Built with Triple-AI Fallback
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-3xl mb-10 font-bold flex flex-col gap-2 shadow-sm shadow-red-50">
                    <p className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Something went wrong:
                    </p>
                    <p className="text-sm font-medium">{error}</p>
                    {error.includes("requires an index") && (
                        <p className="text-sm mt-4 text-red-500 bg-white/50 p-4 rounded-xl border border-red-100">
                            <strong>Action Required:</strong> Please click the link in the console to create the required Firestore index, or follow the instructions in the latest task update.
                        </p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-[2.5rem]" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {classes.map((cls) => (
                        <div
                            key={cls.id}
                            onClick={() => navigate(`/class/${cls.id}`)}
                            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-blue-50/50 transition-all group flex flex-col cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                                    </svg>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                                        {Math.round((cls.completedLessons / cls.totalLessons) * 100)}% COMPLETE
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleCloneClass(e, cls)}
                                            className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"
                                            title="Clone Class"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClass(e, cls.id)}
                                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"
                                            title="Delete Class"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 mb-1 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{cls.name}</h3>
                            <div className="flex flex-col mb-6">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Student: {cls.studentName || 'Not set'}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teacher: {cls.teacherName}</p>
                            </div>

                            <div className="mt-auto pt-6 border-t border-gray-50 flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                <span>{cls.studentCount} Student{cls.studentCount !== 1 ? 's' : ''}</span>
                                <span>Day {cls.completedLessons + 1} / {cls.totalLessons}</span>
                            </div>
                        </div>
                    ))}

                    <div
                        onClick={() => setIsModalOpen(true)}
                        className="border-2 border-dashed border-gray-100 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center group hover:border-blue-200 hover:bg-blue-50/5 transition-all cursor-pointer min-h-[18rem]"
                    >
                        <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:rotate-12 group-hover:scale-110 transition-all shadow-sm">
                            <svg className="w-10 h-10 text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-black text-gray-400 group-hover:text-blue-600 transition-colors uppercase tracking-widest">Add New Class</h3>
                    </div>
                </div>
            )}

            <CreateClassModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { }}
            />
        </div>
    );
};

export default Dashboard;
