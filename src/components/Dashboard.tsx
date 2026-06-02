import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { StudentData, ClassData } from '../types';
import { useStudentMigration } from '../utils/useStudentMigration';

// Modals
import CreateClassModal from './CreateClassModal';
import CreateStudentModal from './CreateStudentModal';
import CloneClassModal from './CloneClassModal';
import ClassCard from './ClassCard';

const ACCENT_COLORS = [
    { gradient: 'from-blue-500 to-indigo-600', icon: 'bg-blue-50 text-blue-600', badge: 'bg-blue-50 text-blue-700' },
    { gradient: 'from-violet-500 to-purple-600', icon: 'bg-violet-50 text-violet-600', badge: 'bg-violet-50 text-violet-700' },
    { gradient: 'from-emerald-500 to-teal-600', icon: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
    { gradient: 'from-rose-500 to-pink-600', icon: 'bg-rose-50 text-rose-600', badge: 'bg-rose-50 text-rose-700' },
    { gradient: 'from-amber-500 to-orange-600', icon: 'bg-amber-50 text-amber-600', badge: 'bg-amber-50 text-amber-700' },
    { gradient: 'from-cyan-500 to-sky-600', icon: 'bg-cyan-50 text-cyan-600', badge: 'bg-cyan-50 text-cyan-700' },
];

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    useStudentMigration(); // Runs migration silently on load

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // Data states
    const [students, setStudents] = useState<StudentData[]>([]);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Selection state
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [classFilter, setClassFilter] = useState<'all' | 'in-progress' | 'completed'>('in-progress');

    // Modals state
    const [studentModalOpen, setStudentModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
    
    const [classModalOpen, setClassModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassData | null>(null);
    
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [classToClone, setClassToClone] = useState<ClassData | null>(null);

    useEffect(() => {
        if (!user) return;
        
        const qStudents = query(collection(db, 'students'), where('userId', '==', user.uid));
        const unsubStudents = onSnapshot(qStudents, (snap) => {
            const fetchedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() })) as StudentData[];
            // Client-side sort by createdAt descending to avoid requiring a Firebase composite index
            fetchedStudents.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            setStudents(fetchedStudents);
        });

        const qClasses = query(collection(db, 'classes'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
        const unsubClasses = onSnapshot(qClasses, (snap) => {
            setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClassData[]);
            setLoading(false);
        });

        return () => { unsubStudents(); unsubClasses(); };
    }, [user]);

    // Derived Data
    const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId]);
    
    const displayedClasses = useMemo(() => {
        let filtered = classes;
        if (selectedStudentId) {
            filtered = filtered.filter(c => c.studentId === selectedStudentId);
        }
        
        return filtered.filter(c => {
            const isCompleted = c.status === 'completed' || (c.status !== 'in-progress' && c.totalLessons > 0 && c.completedLessons >= c.totalLessons);
            if (classFilter === 'in-progress') return !isCompleted;
            if (classFilter === 'completed') return isCompleted;
            return true;
        });
    }, [classes, selectedStudentId, classFilter]);

    // Handlers
    const handleDeleteStudent = async (e: React.MouseEvent, sId: string) => {
        e.stopPropagation();
        if (window.confirm('Delete this student? This will NOT delete their classes immediately, but they will be orphaned.')) {
            await deleteDoc(doc(db, 'students', sId));
            if (selectedStudentId === sId) setSelectedStudentId(null);
        }
    };

    const handleDeleteClass = async (e: React.MouseEvent, classId: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this class?')) {
            await deleteDoc(doc(db, 'classes', classId));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* ── Navbar ── */}
            <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shrink-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-y-3">
                    <div className="flex items-center gap-3 w-1/2 md:w-auto">
                        <img src="/icon-48x48.png" alt="Queen's Classes" className="w-8 h-8 rounded-lg shrink-0 object-cover" />
                        <span className="font-black text-slate-900 text-lg truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>Queen's Classes</span>
                    </div>

                    <div className="flex gap-1 sm:gap-4 order-3 md:order-none w-full md:w-auto justify-center md:absolute md:left-1/2 md:-translate-x-1/2">
                        <div className="px-4 py-2 bg-slate-100 rounded-full text-sm font-bold text-slate-900 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            My Classes
                        </div>
                        <button 
                            onClick={() => window.location.href = '/fun-corner'}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.5L15 9l4.5-1.5L18 15H6l-1.5-7.5L9 9l3-4.5zM6 15v2.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V15" />
                            </svg>
                            Queen's Corner
                        </button>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 w-1/2 md:w-auto justify-end">
                        <div
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:bg-blue-700 transition-colors shrink-0"
                        >
                            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'T'}
                        </div>
                    </div>
                </div>
            </nav>

            {/* ── Settings Modal ── */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsSettingsOpen(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Profile & Settings</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="space-y-8">
                            {/* ── Profile Section ── */}
                            <div>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-600/20">
                                        {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'T'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{user?.displayName || 'Tutor'}</h3>
                                        <p className="text-sm text-slate-500 font-medium">{user?.email}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display Name</label>
                                        <input 
                                            type="text" 
                                            defaultValue={user?.displayName || ''}
                                            placeholder="Your Name"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
                                            onBlur={async (e) => {
                                                const newName = e.target.value.trim();
                                                if (newName && newName !== user?.displayName) {
                                                    try {
                                                        const { updateProfile } = await import('firebase/auth');
                                                        if (user) await updateProfile(user, { displayName: newName });
                                                    } catch (err) {
                                                        console.error("Failed to update profile", err);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                        <input 
                                            type="email" 
                                            value={user?.email || ''} 
                                            disabled 
                                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Stats Section ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black text-blue-600 mb-1">{students.length}</span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800/60">Students</span>
                                </div>
                                <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black text-indigo-600 mb-1">{classes.length}</span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-800/60">Active Classes</span>
                                </div>
                            </div>

                            {/* ── Actions ── */}
                            <div className="pt-2">
                                <button
                                    onClick={() => { setIsSettingsOpen(false); logout(); }}
                                    className="w-full py-4 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 hover:text-red-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    Sign Out Securely
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Layout ── */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6 items-stretch">
                
                {/* Sidebar: Student Roster */}
                <aside className="w-full md:w-80 flex flex-col shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Your Students</h2>
                        <button
                            onClick={() => { setEditingStudent(null); setStudentModalOpen(true); }}
                            className="bg-blue-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-3xl p-3 shadow-sm flex-1 flex flex-col gap-1 overflow-y-auto min-h-[300px]">
                        <button
                            onClick={() => setSelectedStudentId(null)}
                            className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${!selectedStudentId ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${!selectedStudentId ? 'bg-white/20' : 'bg-slate-100'}`}>🌍</div>
                            <span className="font-semibold text-sm">All Classes Overview</span>
                        </button>

                        <div className="h-px bg-slate-100 my-2 mx-2" />

                        {students.filter(s => !s.archived).map(s => (
                            <div key={s.id} className="relative group">
                                <button
                                    onClick={() => setSelectedStudentId(s.id)}
                                    className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 pr-10 ${selectedStudentId === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${selectedStudentId === s.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {s.name[0].toUpperCase()}
                                    </div>
                                    <div className="truncate">
                                        <p className="font-semibold text-sm truncate">{s.name}</p>
                                        <p className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${selectedStudentId === s.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {classes.filter(c => c.studentId === s.id).length} classes
                                        </p>
                                    </div>
                                </button>
                                
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingStudent(s); setStudentModalOpen(true); }} className={`p-1.5 rounded-lg transition-all ${selectedStudentId === s.id ? 'text-blue-200 hover:bg-blue-700 hover:text-white' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button onClick={(e) => handleDeleteStudent(e, s.id)} className={`p-1.5 rounded-lg transition-all ${selectedStudentId === s.id ? 'text-blue-200 hover:bg-red-500 hover:text-white' : 'text-slate-400 hover:bg-red-100 hover:text-red-600'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {students.length === 0 && (
                            <div className="text-center p-6 text-slate-400 text-sm">No students yet.</div>
                        )}
                    </div>
                </aside>

                {/* Main Area: Classes */}
                <main className="flex-1 flex flex-col min-w-0">
                    <header className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                    {selectedStudent ? `${selectedStudent.name}'s Classes` : 'Overview'}
                                </h1>
                                {selectedStudent?.notes && (
                                    <p className="text-sm text-slate-500 mt-2 bg-slate-100 p-3 rounded-xl border border-slate-200 inline-block">{selectedStudent.notes}</p>
                                )}
                            </div>
                            <button
                                onClick={() => { setEditingClass(null); setClassModalOpen(true); }}
                                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                New Class
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b border-slate-200 pb-px">
                            {(['in-progress', 'completed', 'all'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setClassFilter(f)}
                                    className={`px-4 py-2.5 text-sm font-bold capitalize transition-all border-b-2 ${classFilter === f ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                >
                                    {f.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </header>

                    {loading ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
                            {[1, 2, 3].map(i => <div key={i} className="h-56 bg-slate-100 animate-pulse rounded-3xl" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5 pb-10">
                            {displayedClasses.map((cls, idx) => (
                                <ClassCard 
                                    key={cls.id} 
                                    cls={cls} 
                                    accent={ACCENT_COLORS[idx % ACCENT_COLORS.length]} 
                                    onEdit={(e, c) => { e.stopPropagation(); setEditingClass(c); setClassModalOpen(true); }}
                                    onClone={(e, c) => { e.stopPropagation(); setClassToClone(c); setCloneModalOpen(true); }}
                                    onDelete={handleDeleteClass}
                                />
                            ))}

                            {displayedClasses.length === 0 && (
                                <div
                                    onClick={() => { setEditingClass(null); setClassModalOpen(true); }}
                                    className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center group hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer min-h-[200px]"
                                >
                                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:scale-110 group-hover:rotate-6 transition-all shadow-sm">
                                        <svg className="w-7 h-7 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <h3 className="font-black text-slate-400 group-hover:text-blue-600 transition-colors text-base" style={{ fontFamily: 'Outfit, sans-serif' }}>Add New Class</h3>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Modals */}
            <CreateStudentModal
                isOpen={studentModalOpen}
                onClose={() => { setStudentModalOpen(false); setEditingStudent(null); }}
                initialData={editingStudent}
            />

            <CreateClassModal
                isOpen={classModalOpen}
                onClose={() => { setClassModalOpen(false); setEditingClass(null); }}
                onSuccess={() => {}}
                initialData={editingClass}
                students={students}
                currentStudentId={selectedStudentId}
            />

            <CloneClassModal
                isOpen={cloneModalOpen}
                onClose={() => { setCloneModalOpen(false); setClassToClone(null); }}
                classToClone={classToClone}
                students={students}
                currentStudentId={selectedStudentId}
            />
        </div>
    );
};

export default Dashboard;
