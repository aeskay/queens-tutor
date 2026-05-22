import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LessonDashboard from './LessonDashboard';
import UploadedContentsDashboard from './UploadedContentsDashboard';
import { extractTextFromMultiplePDFs } from '../utils/pdfExtractor';

const ClassDetail: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();

    const [classData, setClassData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Sidebar state
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [editingDay, setEditingDay] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [showAddModule, setShowAddModule] = useState(false);
    const [addCount, setAddCount] = useState(1);
    const [newTitles, setNewTitles] = useState<string[]>([]);
    const [newSummary, setNewSummary] = useState('');
    const [activeView, setActiveView] = useState<'lessons' | 'contents'>('lessons');

    // ── Firestore listener ────────────────────────────────────────────────────
    useEffect(() => {
        if (!classId) return;
        const unsubscribe = onSnapshot(doc(db, 'classes', classId), (snap) => {
            if (snap.exists()) {
                const data: any = snap.data();
                setClassData({ id: snap.id, ...data });
                if (data.lessons && !selectedDay) setSelectedDay(1);
            } else {
                setError('Class not found.');
            }
            setLoading(false);
        }, (err) => {
            console.error('Firestore error:', err);
            setError(err.message);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [classId]);

    // ── Generate lessons ──────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (files.length === 0 || !classId) return;
        setIsGenerating(true);
        setIsExtracting(true);
        setError(null);

        try {
            const extractedText = await extractTextFromMultiplePDFs(files);
            setIsExtracting(false);

            if (extractedText.trim().length < 50) {
                throw new Error('Could not read text from the PDF. Please ensure the file is not image-only or password-protected.');
            }

            // Generate summaries for each initial file
            const initialContents: any[] = [];
            for (const file of files) {
                const singleText = await extractTextFromMultiplePDFs([file]);
                try {
                    const sumRes = await fetch('/.netlify/functions/generate-summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: singleText.substring(0, 1500), filename: file.name })
                    });
                    if (sumRes.ok) {
                        const { title, summary } = await sumRes.json();
                        initialContents.push({
                            id: Math.random().toString(36).substring(2, 11),
                            title: title || file.name,
                            summary: summary || 'Content extracted from PDF.',
                            createdAt: new Date().toISOString(),
                            text: singleText
                        });
                    }
                } catch (e) {
                    console.error('Failed to get summary for', file.name, e);
                }
            }

            let response;
            try {
                response = await fetch('/.netlify/functions/generate-lessons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: extractedText,
                        totalLessons: classData.totalLessons || 20,
                    }),
                });
            } catch (networkError) {
                throw new Error('Network error: Could not reach the server. Please ensure that you have run "npm start" and that the Netlify dev server is running.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.details
                        ? `Generation failed:\n${data.details.join('\n')}`
                        : data.error || 'Failed to generate lesson plan. Please try again.'
                );
            }

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('AI returned invalid data. Please try again.');
            }

            // Save lessons AND syllabus text AND uploadedContents
            await updateDoc(doc(db, 'classes', classId), {
                lessons: data,
                syllabusText: extractedText,
                uploadedContents: initialContents,
                lastGenerated: new Date().toISOString(),
            });

            setFiles([]);
            setSelectedDay(1);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsGenerating(false);
            setIsExtracting(false);
        }
    };

    // ── Regenerate single module ──────────────────────────────────────────────
    const handleRegenerateModule = useCallback(async (dayNumber: number) => {
        if (!classId || !classData?.lessons) return;
        setIsGenerating(true);
        setError(null);

        try {
            const targetLesson = classData.lessons.find((l: any) => l.dayNumber === dayNumber);
            let syllabusText = classData.syllabusText || '';

            // Only require extraction if we have files but haven't extracted yet
            if (!syllabusText && files.length > 0) {
                setIsExtracting(true);
                syllabusText = await extractTextFromMultiplePDFs(files);
                setIsExtracting(false);
            }

            // For single-module generation, cap the syllabus to 12k chars to save tokens.
            // The context field already tells the AI exactly what topic to generate.
            const MAX_SINGLE_MODULE_CHARS = 12000;
            const textToSend = syllabusText
                ? syllabusText.substring(0, MAX_SINGLE_MODULE_CHARS)
                : `Create a comprehensive lesson plan about ${targetLesson?.topicTitle}. ${targetLesson?.fiveMinuteSummary !== 'Content to be generated.' ? targetLesson?.fiveMinuteSummary : ''}`;

            let response;
            try {
                response = await fetch('/.netlify/functions/generate-lessons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: textToSend,
                        totalLessons: 1,
                        context: `Generate content ONLY for Day ${dayNumber}: "${targetLesson?.topicTitle}". ${targetLesson?.fiveMinuteSummary && targetLesson.fiveMinuteSummary !== 'Content to be generated.' ? `Summary to include/expand on: "${targetLesson.fiveMinuteSummary}". ` : ''}Make it detailed and specific to this topic.`,
                    }),
                });
            } catch (networkError) {
                throw new Error('Network error: Could not reach the server. Please ensure that you have run "npm start" and that the Netlify dev server is running.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Regeneration failed. Please try again.');
            }

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('AI returned invalid data. Please try again.');
            }

            const regenerated = {
                ...data[0],
                dayNumber,
                topicTitle: targetLesson?.topicTitle || data[0].topicTitle,
            };

            const updatedLessons = classData.lessons.map((l: any) =>
                l.dayNumber === dayNumber ? regenerated : l
            );

            await updateDoc(doc(db, 'classes', classId), { lessons: updatedLessons });
        } catch (err: any) {
            console.error('Regeneration error:', err);
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setIsExtracting(false);
        }
    }, [classId, classData, files]);

    // ── Module management ─────────────────────────────────────────────────────
    const handleDeleteModule = async (dayNumber: number) => {
        if (!classId || !classData.lessons) return;
        const updated = classData.lessons
            .filter((l: any) => l.dayNumber !== dayNumber)
            .map((l: any, i: number) => ({ ...l, dayNumber: i + 1 }));
        try {
            await updateDoc(doc(db, 'classes', classId), {
                lessons: updated,
                totalLessons: updated.length,
                completedLessons: updated.filter((l: any) => l.completed).length,
            });
            setSelectedDay(prev => (prev === dayNumber ? 1 : prev > dayNumber ? prev - 1 : prev));
        } catch (err: any) {
            setError('Failed to delete module.');
        }
    };

    const handleClearAllModules = async () => {
        if (!classId || !window.confirm('Delete all modules? This cannot be undone.')) return;
        try {
            await updateDoc(doc(db, 'classes', classId), {
                lessons: null,
                completedLessons: 0,
                totalLessons: 0,
                syllabusText: null,
                lastGenerated: null,
            });
            setSelectedDay(1);
        } catch (err: any) {
            setError('Failed to clear modules.');
        }
    };

    const handleEditTitle = async (dayNumber: number) => {
        if (!classId || !classData.lessons || !editTitle.trim()) return;
        const updated = classData.lessons.map((l: any) =>
            l.dayNumber === dayNumber ? { ...l, topicTitle: editTitle.trim() } : l
        );
        try {
            await updateDoc(doc(db, 'classes', classId), { lessons: updated });
            setEditingDay(null);
        } catch {
            setError('Failed to update title.');
        }
    };

    const handleAddModules = async () => {
        if (!classId) return;
        const current = classData.lessons || [];
        const start = current.length + 1;
        const toAdd = Array.from({ length: addCount }).map((_, i) => ({
            dayNumber: start + i,
            topicTitle: newTitles[i]?.trim() || `New Module ${start + i}`,
            fiveMinuteSummary: addCount === 1 && newSummary.trim() ? newSummary.trim() : 'Content to be generated.',
            detailedLesson: '',
            kidFriendlyExamples: [],
            quiz: { questions: [] },
            completed: false,
        }));
        try {
            const updated = [...current, ...toAdd];
            await updateDoc(doc(db, 'classes', classId), { lessons: updated, totalLessons: updated.length });
            setShowAddModule(false);
            setAddCount(1);
            setNewTitles([]);
            setNewSummary('');
        } catch {
            setError('Failed to add modules.');
        }
    };

    // ── Sidebar content (shared between desktop and mobile) ───────────────────
    const renderSidebar = () => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Sidebar header */}
            <div className="p-5 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Dashboard
                    </button>
                    {classData?.lessons && (
                        <button
                            onClick={handleClearAllModules}
                            className="text-[10px] font-semibold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors"
                        >
                            Clear All
                        </button>
                    )}
                </div>
                <h2 className="text-white font-black text-base leading-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {classData?.name}
                </h2>
                <p className="text-slate-400 text-xs">
                    {classData?.studentName && `${classData.studentName} · `}
                    {classData?.completedLessons || 0} / {classData?.totalLessons || classData?.lessons?.length || 0} done
                </p>
                {/* Progress bar */}
                {classData?.totalLessons > 0 && (
                    <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.round(((classData.completedLessons || 0) / classData.totalLessons) * 100)}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Module list */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {classData?.lessons?.map((lesson: any) => (
                    <div key={lesson.dayNumber} className="group/item relative">
                        <button
                            onClick={() => { setSelectedDay(lesson.dayNumber); setActiveView('lessons'); setIsSidebarOpen(false); }}
                            className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 ${selectedDay === lesson.dayNumber && activeView === 'lessons'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                                }`}
                        >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${selectedDay === lesson.dayNumber && activeView === 'lessons'
                                ? 'bg-white/20 text-white'
                                : lesson.completed
                                    ? 'bg-emerald-900/50 text-emerald-400'
                                    : 'bg-slate-700 text-slate-400'
                                }`}>
                                {lesson.completed
                                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    : lesson.dayNumber
                                }
                            </span>
                            <div className="flex-1 min-w-0 pr-8">
                                {editingDay === lesson.dayNumber ? (
                                    <input
                                        autoFocus
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={() => handleEditTitle(lesson.dayNumber)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleEditTitle(lesson.dayNumber)}
                                        className="w-full bg-white/10 text-white text-sm px-2 py-0.5 rounded border border-white/20 focus:outline-none"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <p className="text-sm font-semibold truncate">{lesson.topicTitle}</p>
                                )}
                            </div>
                        </button>
                        {/* Item actions */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingDay(lesson.dayNumber); setEditTitle(lesson.topicTitle); }}
                                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-all"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this module?')) handleDeleteModule(lesson.dayNumber); }}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-all"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}

                {!classData?.lessons && (
                    <div className="text-center py-12">
                        <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">No lessons yet</p>
                    </div>
                )}
            </nav>

            {/* Add module — always available */}
            <div className="px-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
                {showAddModule ? (
                    <div className="bg-slate-700/50 rounded-2xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add modules</span>
                            <button onClick={() => { setShowAddModule(false); setAddCount(1); setNewTitles([]); setNewSummary(''); }} className="text-slate-500 hover:text-slate-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Count:</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAddCount(Math.max(1, addCount - 1))} className="w-6 h-6 flex items-center justify-center bg-slate-600 rounded-lg text-slate-300 hover:bg-slate-500 text-sm">-</button>
                                <span className="text-sm font-bold text-white w-4 text-center">{addCount}</span>
                                <button onClick={() => setAddCount(Math.min(10, addCount + 1))} className="w-6 h-6 flex items-center justify-center bg-slate-600 rounded-lg text-slate-300 hover:bg-slate-500 text-sm">+</button>
                            </div>
                        </div>
                        {addCount === 1 ? (
                            <div className="space-y-2">
                                <input
                                    placeholder={`Module ${(classData.lessons?.length || 0) + 1} title`}
                                    value={newTitles[0] || ''}
                                    onChange={(e) => { const u = [...newTitles]; u[0] = e.target.value; setNewTitles(u); }}
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-500 font-medium"
                                />
                                <textarea
                                    placeholder="Module summary (optional)"
                                    value={newSummary}
                                    onChange={(e) => setNewSummary(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-500 resize-none font-medium"
                                />
                            </div>
                        ) : (
                            Array.from({ length: addCount }).map((_, i) => (
                                <input
                                    key={i}
                                    placeholder={`Module ${(classData.lessons?.length || 0) + 1 + i} title`}
                                    value={newTitles[i] || ''}
                                    onChange={(e) => { const u = [...newTitles]; u[i] = e.target.value; setNewTitles(u); }}
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                                />
                            ))
                        )}
                        <button onClick={handleAddModules} className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors">
                            Confirm
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAddModule(true)}
                        className="w-full py-3 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        Add Module
                    </button>
                )}
            </div>

            {/* Uploaded Contents — always visible */}
            <div className="px-3 pb-3 pt-2 flex-shrink-0">
                <button
                    onClick={() => { setActiveView('contents'); setIsSidebarOpen(false); }}
                    className={`w-full py-3 border rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider ${activeView === 'contents' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' : 'border-dashed border-slate-600 text-slate-500 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-900/20'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Uploaded Contents
                </button>
            </div>
        </div>
    );

    // ── Loading / error states ─────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent animate-spin rounded-full" />
        </div>
    );

    if (!classData) return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
            <div className="bg-red-50 text-red-500 p-8 rounded-3xl border border-red-100 mb-6">
                <p className="font-bold text-lg mb-2">Class Not Found</p>
                <p className="text-sm text-red-400">{error || 'This class does not exist.'}</p>
            </div>
            <button onClick={() => navigate('/')} className="text-blue-600 font-semibold hover:underline text-sm">← Return to Dashboard</button>
        </div>
    );

    const hasSyllabusContext = !!classData.syllabusText;
    const currentLesson = classData.lessons?.find((l: any) => l.dayNumber === selectedDay);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">

            {/* ── Desktop Sidebar (always visible on lg+) ── */}
            <aside className="hidden lg:flex w-72 flex-col bg-slate-900 shrink-0 overflow-hidden">
                {renderSidebar()}
            </aside>

            {/* ── Mobile Sidebar Overlay ── */}
            {isSidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <aside className="relative w-[280px] bg-slate-900 flex flex-col overflow-hidden z-10">
                        {renderSidebar()}
                    </aside>
                </div>
            )}

            {/* ── Main content ── */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Current Lesson</p>
                            <h2 className="text-sm font-black text-slate-900 truncate max-w-[200px] sm:max-w-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                {currentLesson?.topicTitle || classData.name}
                            </h2>
                        </div>
                    </div>

                    {/* Context indicator */}
                    <div className="flex items-center gap-2">
                        {hasSyllabusContext && !isGenerating && (
                            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-100">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                PDF saved
                            </div>
                        )}
                        {isGenerating && (
                            <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <span className="hidden sm:inline">{isExtracting ? 'Reading PDF...' : 'Generating...'}</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Error banner */}
                {error && (
                    <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 py-3 flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-700 whitespace-pre-wrap">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {/* Content area */}
                <div className="flex-1 overflow-y-auto">
                    {activeView === 'contents' ? (
                        <UploadedContentsDashboard classData={classData} />
                    ) : classData.lessons ? (
                        <div className="p-4 sm:p-6 lg:p-10">
                            <LessonDashboard
                                lessons={classData.lessons}
                                classId={classId}
                                selectedDay={selectedDay}
                                onRegenerate={handleRegenerateModule}
                                isRegenerating={isGenerating}
                            />
                        </div>
                    ) : (
                        /* ── Upload / Generate UI ── */
                        <div className="flex items-center justify-center min-h-full p-4 py-12">
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 sm:p-12 max-w-lg w-full text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>

                                <h2 className="text-2xl font-black text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                    No Lesson Plan Yet
                                </h2>
                                <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                                    Upload your syllabus PDF and AI will generate a complete{' '}
                                    <strong>{classData.totalLessons || 20}-day lesson plan</strong> with summaries, deep dives, activities and quizzes.
                                </p>

                                {/* File picker */}
                                <label className="block cursor-pointer mb-4">
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={(e) => e.target.files && setFiles(Array.from(e.target.files))}
                                    />
                                    <div className={`border-2 border-dashed rounded-2xl p-8 transition-all ${files.length > 0
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                                        }`}>
                                        <div className="flex flex-col items-center gap-2">
                                            {files.length > 0 ? (
                                                <>
                                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-1">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <p className="text-blue-700 font-bold text-sm">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
                                                    <p className="text-blue-500 text-xs">{files.map(f => f.name).join(', ')}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-8 h-8 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                    <p className="text-slate-600 font-semibold text-sm">Click to select PDF files</p>
                                                    <p className="text-slate-400 text-xs">Max 10MB per file · Multiple files allowed</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </label>

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || files.length === 0}
                                    className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>{isExtracting ? 'Reading PDF...' : 'Generating lessons...'}</span>
                                            </div>
                                            <span className="text-xs text-white/60 font-normal">This may take 30–60 seconds</span>
                                        </>
                                    ) : (
                                        `Generate ${classData.totalLessons || 20}-Day Plan`
                                    )}
                                </button>

                                <div className="flex items-center gap-3 my-2">
                                    <div className="flex-1 h-px bg-slate-100" />
                                    <span className="text-xs text-slate-400 font-semibold">or</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>

                                <button
                                    onClick={() => { setShowAddModule(true); setIsSidebarOpen(true); }}
                                    className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 font-semibold text-sm hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    Add Module Manually
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ClassDetail;
