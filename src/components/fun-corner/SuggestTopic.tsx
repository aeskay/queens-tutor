import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { TopicSuggestion } from '../../types';
import AssignTopicsModal from './AssignTopicsModal';

const SuggestTopic: React.FC = () => {
    const { user } = useAuth();
    const [ageGroup, setAgeGroup] = useState('');
    const [interests, setInterests] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'suggestedTopics'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: TopicSuggestion[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as TopicSuggestion);
            });
            // Sort client-side if no index exists, or add orderBy in query if index exists.
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setSuggestions(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleGenerate = async () => {
        if (!ageGroup.trim() || !user) return;
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/suggest-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ageGroup, interests })
            });

            if (!response.ok) {
                throw new Error('Failed to generate suggestions. Please try again.');
            }

            const data = await response.json();
            const newTopics = data.suggestions || [];

            // Save to Firestore
            const batch = writeBatch(db);
            newTopics.forEach((topic: any) => {
                const docRef = doc(collection(db, 'suggestedTopics'));
                batch.set(docRef, {
                    userId: user.uid,
                    topicTitle: topic.topicTitle,
                    summary: topic.summary,
                    ageGroup,
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();

            setAgeGroup('');
            setInterests('');
        } catch (err: any) {
            console.error('Error generating topics:', err);
            setError(err.message || 'An error occurred while generating topics.');
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'suggestedTopics', id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err) {
            console.error('Error deleting suggestion:', err);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Clear all suggested topics?')) return;
        try {
            const batch = writeBatch(db);
            suggestions.forEach(s => {
                batch.delete(doc(db, 'suggestedTopics', s.id));
            });
            await batch.commit();
            setSelectedIds(new Set());
        } catch (err) {
            console.error('Error clearing suggestions:', err);
        }
    };

    const selectedTopicsData = suggestions.filter(s => selectedIds.has(s.id));

    return (
        <div className="flex flex-col md:flex-row gap-8">
            {/* ── Generator Form ── */}
            <div className="w-full md:w-1/3 space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Generate Ideas</h3>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
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
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Interests / Focus (Optional)</label>
                            <textarea
                                placeholder="e.g. Dinosaurs, Space, Creative Writing, Math puzzles"
                                rows={3}
                                value={interests}
                                onChange={e => setInterests(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium resize-none"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!ageGroup.trim() || isGenerating}
                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isGenerating ? 'Generating...' : 'Suggest 5 Topics'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Suggestions List ── */}
            <div className="w-full md:w-2/3 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Suggested Topics</h3>
                        <p className="text-sm text-slate-500">{suggestions.length} available</p>
                    </div>
                    <div className="flex gap-3">
                        {suggestions.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={() => setIsAssignModalOpen(true)}
                            disabled={selectedIds.size === 0}
                            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            Assign Selected ({selectedIds.size})
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                {suggestions.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 p-8">
                        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        <p className="font-semibold text-slate-500 mb-1">No topics yet</p>
                        <p className="text-sm text-center">Use the generator to get some fun ideas!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[600px] pr-2">
                        {suggestions.map(suggestion => (
                            <div
                                key={suggestion.id}
                                onClick={() => toggleSelection(suggestion.id)}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group flex gap-4 ${
                                    selectedIds.has(suggestion.id)
                                        ? 'border-blue-500 bg-blue-50/50'
                                        : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="mt-1">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                        selectedIds.has(suggestion.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 group-hover:border-blue-400'
                                    }`}>
                                        {selectedIds.has(suggestion.id) && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-800 text-base leading-tight">
                                            {suggestion.topicTitle}
                                        </h4>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(suggestion.id); }}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            title="Delete suggestion"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-3">{suggestion.summary}</p>
                                    <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                                        Age: {suggestion.ageGroup}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isAssignModalOpen && (
                <AssignTopicsModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    selectedTopics={selectedTopicsData}
                    onAssignSuccess={() => {
                        setIsAssignModalOpen(false);
                        setSelectedIds(new Set()); // Deselect after assignment
                    }}
                />
            )}
        </div>
    );
};

export default SuggestTopic;
