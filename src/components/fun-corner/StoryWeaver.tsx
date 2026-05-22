import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { StoryGame } from '../../types';
import StoryReaderModal from './StoryReaderModal';

const StoryWeaver: React.FC = () => {
    const { user } = useAuth();
    const [topic, setTopic] = useState('');
    const [studentName, setStudentName] = useState('');
    const [ageGroup, setAgeGroup] = useState('');
    const [setting, setSetting] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [stories, setStories] = useState<StoryGame[]>([]);
    const [readingStory, setReadingStory] = useState<StoryGame | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'stories'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: StoryGame[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as StoryGame);
            });
            // Sort client-side
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setStories(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleGenerate = async () => {
        if (!topic.trim() || !studentName.trim() || !ageGroup.trim() || !user) return;
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/generate-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, studentName, ageGroup, setting })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate story. Please try again.');
            }

            const data = await response.json();

            // Save to Firestore
            const docRef = doc(collection(db, 'stories'));
            await setDoc(docRef, {
                userId: user.uid,
                topic: data.topic || topic,
                studentName,
                ageGroup,
                setting: setting || 'AI Determined',
                title: data.title,
                paragraphs: data.paragraphs,
                moralOrFact: data.moralOrFact,
                createdAt: serverTimestamp()
            });

            setTopic('');
        } catch (err: any) {
            console.error('Error generating story:', err);
            setError(err.message || 'An error occurred while generating the story.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this story?')) return;
        try {
            await deleteDoc(doc(db, 'stories', id));
        } catch (err) {
            console.error('Error deleting story:', err);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Clear all stories?')) return;
        try {
            const batch = writeBatch(db);
            stories.forEach(s => {
                batch.delete(doc(db, 'stories', s.id));
            });
            await batch.commit();
        } catch (err) {
            console.error('Error clearing stories:', err);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 relative h-full min-h-[500px]">
            {/* ── Generator Form ── */}
            <div className="w-full md:w-1/3 space-y-6 shrink-0">
                <div className="bg-[#fdfaf6] p-6 rounded-2xl border border-[#ebd7b1] sticky top-24 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">📖</span>
                        <h3 className="text-lg font-black text-[#8b5a2b]" style={{ fontFamily: 'Outfit, sans-serif' }}>Story Weaver</h3>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#8b5a2b]/70 uppercase tracking-wider mb-1.5">Topic *</label>
                            <input
                                type="text"
                                placeholder="e.g. Ancient Egypt, Dinosaurs..."
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-[#ebd7b1]/60 rounded-xl focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#8b5a2b]/70 uppercase tracking-wider mb-1.5">Student's Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Timmy (Main Character)"
                                value={studentName}
                                onChange={e => setStudentName(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-[#ebd7b1]/60 rounded-xl focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#8b5a2b]/70 uppercase tracking-wider mb-1.5">Age or Grade Level *</label>
                            <input
                                type="text"
                                placeholder="e.g. 10 years old, 5th Grade"
                                value={ageGroup}
                                onChange={e => setAgeGroup(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-[#ebd7b1]/60 rounded-xl focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#8b5a2b]/70 uppercase tracking-wider mb-1.5">Setting / Theme (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. Space, Jungle, or leave blank"
                                value={setting}
                                onChange={e => setSetting(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-[#ebd7b1]/60 rounded-xl focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!topic.trim() || !studentName.trim() || !ageGroup.trim() || isGenerating}
                            className="w-full py-3 rounded-xl bg-[#8b5a2b] text-white font-bold text-sm shadow-lg shadow-[#8b5a2b]/25 hover:bg-[#724a23] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isGenerating ? 'Writing Story...' : 'Generate Story'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Story List ── */}
            <div className="w-full md:w-2/3 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Your Stories</h3>
                        <p className="text-sm text-slate-500">{stories.length} stories available</p>
                    </div>
                    {stories.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {stories.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-[#ebd7b1] bg-[#fdfaf6]/50 rounded-3xl flex flex-col items-center justify-center text-[#8b5a2b]/60 p-8 h-full min-h-[300px]">
                        <div className="w-16 h-16 bg-[#ebd7b1]/30 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">✨</span>
                        </div>
                        <p className="font-semibold mb-1">No stories woven yet</p>
                        <p className="text-sm text-center max-w-[250px]">Enter a topic and name to weave a personalized magical story!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 pb-4">
                        {stories.map(story => (
                            <div
                                key={story.id}
                                className="p-5 rounded-2xl border border-[#ebd7b1] bg-[#fdfaf6] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[#8b5a2b] text-lg leading-tight truncate mb-1">
                                        {story.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="inline-block px-2 py-0.5 bg-[#d4af37]/20 text-[#8b5a2b] text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                                            Topic: {story.topic}
                                        </span>
                                        <span className="inline-block px-2 py-0.5 bg-[#d4af37]/20 text-[#8b5a2b] text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0">
                                            Star: {story.studentName}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#8b5a2b]/70 font-medium truncate">
                                        {story.paragraphs[0]?.substring(0, 80)}...
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    <button
                                        onClick={() => handleDelete(story.id)}
                                        className="p-3 text-[#8b5a2b]/50 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                                        title="Delete story"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setReadingStory(story)}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-[#8b5a2b] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#8b5a2b]/20 hover:bg-[#724a23] transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                        Read Story
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {readingStory && (
                <StoryReaderModal
                    story={readingStory}
                    onClose={() => setReadingStory(null)}
                />
            )}
        </div>
    );
};

export default StoryWeaver;
