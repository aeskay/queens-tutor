import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { TriviaGame } from '../../types';
import TriviaPlayerModal from './TriviaPlayerModal';

const TriviaGenerator: React.FC = () => {
    const { user } = useAuth();
    const [topic, setTopic] = useState('');
    const [ageGroup, setAgeGroup] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [trivias, setTrivias] = useState<TriviaGame[]>([]);
    const [playingTrivia, setPlayingTrivia] = useState<TriviaGame | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'trivias'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: TriviaGame[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as TriviaGame);
            });
            // Sort client-side
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setTrivias(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleGenerate = async () => {
        if (!topic.trim() || !ageGroup.trim() || !user) return;
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/generate-trivia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, ageGroup })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate trivia. Please try again.');
            }

            const data = await response.json();

            // Save to Firestore
            const docRef = doc(collection(db, 'trivias'));
            await setDoc(docRef, {
                userId: user.uid,
                topic: data.topic || topic,
                ageGroup,
                questions: data.questions,
                createdAt: serverTimestamp()
            });

            setTopic('');
        } catch (err: any) {
            console.error('Error generating trivia:', err);
            setError(err.message || 'An error occurred while generating trivia.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this trivia game?')) return;
        try {
            await deleteDoc(doc(db, 'trivias', id));
        } catch (err) {
            console.error('Error deleting trivia:', err);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Clear all trivia games?')) return;
        try {
            const batch = writeBatch(db);
            trivias.forEach(t => {
                batch.delete(doc(db, 'trivias', t.id));
            });
            await batch.commit();
        } catch (err) {
            console.error('Error clearing trivias:', err);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 relative h-full min-h-[500px]">
            {/* ── Generator Form ── */}
            <div className="w-full md:w-1/3 space-y-6 shrink-0">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 sticky top-24">
                    <h3 className="text-lg font-black text-slate-800 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Create Trivia</h3>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Topic *</label>
                            <input
                                type="text"
                                placeholder="e.g. Ancient Egypt, Dinosaurs..."
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Age or Grade Level *</label>
                            <input
                                type="text"
                                placeholder="e.g. 10 years old, 5th Grade"
                                value={ageGroup}
                                onChange={e => setAgeGroup(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!topic.trim() || !ageGroup.trim() || isGenerating}
                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isGenerating ? 'Generating 10 Questions...' : 'Generate Trivia'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Trivia List ── */}
            <div className="w-full md:w-2/3 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Your Trivia Games</h3>
                        <p className="text-sm text-slate-500">{trivias.length} available to play</p>
                    </div>
                    {trivias.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {trivias.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 p-8 h-full min-h-[300px]">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">🎯</span>
                        </div>
                        <p className="font-semibold text-slate-500 mb-1">No trivia games yet</p>
                        <p className="text-sm text-center">Enter a topic and age group to generate a fun 10-question trivia game!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 pb-4">
                        {trivias.map(game => (
                            <div
                                key={game.id}
                                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight truncate">
                                            {game.topic}
                                        </h4>
                                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                                            Age: {game.ageGroup}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {game.questions?.length || 0} Questions
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleDelete(game.id)}
                                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                                        title="Delete game"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setPlayingTrivia(game)}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                        Play Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {playingTrivia && (
                <TriviaPlayerModal
                    game={playingTrivia}
                    onClose={() => setPlayingTrivia(null)}
                />
            )}
        </div>
    );
};

export default TriviaGenerator;
