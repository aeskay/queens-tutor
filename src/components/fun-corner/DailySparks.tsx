import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { DailySpark } from '../../types';

const CATEGORIES = [
    'Pronunciation Challenge',
    'Word of the Day',
    'Idioms & Phrases',
    'Grammar Myth Busted',
    'Spelling Challenge',
    'Figures of Speech',
    'Vocabulary Builder',
    'Punctuation Spotlight',
    'Word Origins (Etymology)',
    'Tongue Twister',
    '5-Minute Word Game',
    'Random English Fun',
    "Don't Say This, Say This"
];

// Quick country picks — teacher can also type manually
const QUICK_COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'India', 'Australia'];

const DailySparks: React.FC = () => {
    const { user } = useAuth();
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [ageGroup, setAgeGroup] = useState('');
    const [country, setCountry] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sparks, setSparks] = useState<DailySpark[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'sparks'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: DailySpark[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as DailySpark);
            });
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setSparks(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleGenerate = async () => {
        if (!category || !ageGroup.trim() || !user) return;
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/generate-spark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, ageGroup, country: country.trim() })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate spark. Please try again.');
            }

            const data = await response.json();

            const docRef = doc(collection(db, 'sparks'));
            await setDoc(docRef, {
                userId: user.uid,
                category: data.category || category,
                ageGroup,
                country: country.trim() || null,
                title: data.title,
                theHook: data.theHook,
                theCoreContent: data.theCoreContent,
                interactiveElement: data.interactiveElement,
                funFact: data.funFact,
                createdAt: serverTimestamp()
            });

        } catch (err: any) {
            console.error('Error generating spark:', err);
            setError(err.message || 'An error occurred while generating the spark.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this Daily Spark?')) return;
        try {
            await deleteDoc(doc(db, 'sparks', id));
        } catch (err) {
            console.error('Error deleting spark:', err);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Clear all Daily Sparks?')) return;
        try {
            const batch = writeBatch(db);
            sparks.forEach(s => {
                batch.delete(doc(db, 'sparks', s.id));
            });
            await batch.commit();
        } catch (err) {
            console.error('Error clearing sparks:', err);
        }
    };

    // Render bullet-pointed core content
    const renderCoreContent = (text: string) => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const hasBullets = lines.some(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'));
        if (hasBullets) {
            return (
                <ul className="space-y-2">
                    {lines.map((line, i) => {
                        const clean = line.replace(/^[•\-\*]\s*/, '');
                        return (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-blue-400 mt-0.5 text-base leading-none shrink-0">•</span>
                                <span className="text-slate-600 font-medium leading-snug text-sm">{clean}</span>
                            </li>
                        );
                    })}
                </ul>
            );
        }
        return <p className="text-slate-600 font-medium leading-relaxed text-sm">{text}</p>;
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 relative h-full min-h-[500px]">
            {/* ── Generator Form ── */}
            <div className="w-full md:w-1/3 space-y-6 shrink-0">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 sticky top-24 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">⚡</span>
                        <h3 className="text-lg font-black text-amber-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Daily Sparks</h3>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
                        {/* Category */}
                        <div>
                            <label className="block text-xs font-semibold text-amber-900/70 uppercase tracking-wider mb-1.5">Category *</label>
                            <div className="relative">
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-300 focus:border-amber-400 focus:outline-none transition-all text-sm font-bold text-amber-900 appearance-none cursor-pointer"
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Age Group */}
                        <div>
                            <label className="block text-xs font-semibold text-amber-900/70 uppercase tracking-wider mb-1.5">Age or Grade Level *</label>
                            <input
                                type="text"
                                placeholder="e.g. 10 years old, 5th Grade, SS2"
                                value={ageGroup}
                                onChange={e => setAgeGroup(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-300 focus:border-amber-400 focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        {/* Country */}
                        <div>
                            <label className="block text-xs font-semibold text-amber-900/70 uppercase tracking-wider mb-1.5">
                                Country <span className="font-normal normal-case text-amber-700/50">(for relevant examples)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Nigeria, Ghana, UK..."
                                value={country}
                                onChange={e => setCountry(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-300 focus:border-amber-400 focus:outline-none transition-all text-sm font-medium mb-2"
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_COUNTRIES.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCountry(c)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${country === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-800 border-amber-200 hover:border-amber-400'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={!ageGroup.trim() || isGenerating}
                            className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/25 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            {isGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isGenerating ? 'Sparking...' : 'Generate Spark ⚡'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Sparks List ── */}
            <div className="w-full md:w-2/3 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Your Classroom Sparks</h3>
                        <p className="text-sm text-slate-500">{sparks.length} spark{sparks.length !== 1 ? 's' : ''} saved</p>
                    </div>
                    {sparks.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {sparks.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-amber-200 bg-amber-50/50 rounded-3xl flex flex-col items-center justify-center text-amber-900/40 p-8 h-full min-h-[300px]">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-3xl">💡</span>
                        </div>
                        <p className="font-bold mb-1">No sparks generated yet</p>
                        <p className="text-sm text-center max-w-[280px]">Select a category, age group, and country to generate a punchy 5-minute classroom activity!</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-4">
                        {sparks.map(spark => (
                            <div
                                key={spark.id}
                                className="relative rounded-[2rem] border-2 border-slate-100 bg-white shadow-xl shadow-slate-200/50 overflow-hidden"
                            >
                                {/* Delete Button */}
                                <button
                                    onClick={() => handleDelete(spark.id)}
                                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                                    title="Delete spark"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>

                                {/* Header Area */}
                                <div className="bg-amber-500 p-6 sm:px-8 sm:py-6 text-white pr-16">
                                    <div className="flex items-center flex-wrap gap-2 mb-2 opacity-90">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-2 py-1 rounded-md">
                                            {spark.category}
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-2 py-1 rounded-md">
                                            {spark.ageGroup}
                                        </span>
                                        {spark.country && (
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-2 py-1 rounded-md">
                                                🌍 {spark.country}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-black text-2xl sm:text-3xl leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                        {spark.title}
                                    </h4>
                                </div>

                                {/* Content Area */}
                                <div className="p-6 sm:p-8 space-y-6">
                                    {/* The Hook */}
                                    <div>
                                        <h5 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                            The Hook
                                        </h5>
                                        <p className="text-lg font-bold text-slate-800 leading-snug">
                                            "{spark.theHook}"
                                        </p>
                                    </div>

                                    {/* The Core Content */}
                                    <div>
                                        <h5 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                            The Lesson
                                        </h5>
                                        {renderCoreContent(spark.theCoreContent)}
                                    </div>

                                    {/* Interactive Element */}
                                    <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl">
                                        <h5 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">
                                            Action! (Do this now)
                                        </h5>
                                        <p className="text-emerald-900 font-bold text-sm">
                                            {spark.interactiveElement}
                                        </p>
                                    </div>

                                    {/* Fun Fact */}
                                    <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
                                            💡
                                        </div>
                                        <div>
                                            <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Fun Fact</h5>
                                            <p className="text-sm font-semibold text-slate-500">
                                                {spark.funFact}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailySparks;
