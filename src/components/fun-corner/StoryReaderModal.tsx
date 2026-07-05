import React, { useState } from 'react';
import type { StoryGame } from '../../types';

interface StoryReaderModalProps {
    story: StoryGame;
    onClose: () => void;
}

const StoryReaderModal: React.FC<StoryReaderModalProps> = ({ story, onClose }) => {
    // Interactive Quiz State
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [revealExplanations, setRevealExplanations] = useState<Record<number, boolean>>({});

    const handleSelectOption = (qIdx: number, option: string) => {
        if (selectedAnswers[qIdx]) return; // Answer already locked
        setSelectedAnswers(prev => ({ ...prev, [qIdx]: option }));
        setRevealExplanations(prev => ({ ...prev, [qIdx]: true }));
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/95 backdrop-blur-md">
            <div className="bg-[#fcfaf5] rounded-[2rem] w-full max-w-3xl flex flex-col h-[90vh] shadow-2xl overflow-hidden relative">
                
                {/* ── Header ── */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-[#ebd7b1]/50 bg-[#fdfaf6] z-10 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📖</span>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#d4af37]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                Story Weaver
                            </h2>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* ── Content Area ── */}
                <div className="flex-1 overflow-y-auto px-6 py-10 sm:px-12 sm:py-16">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#2c3e50] mb-10 leading-tight text-center" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            {story.title}
                        </h1>

                        <div className="space-y-6 sm:space-y-8 text-lg sm:text-xl leading-relaxed text-[#34495e] mb-16" style={{ fontFamily: 'Georgia, serif' }}>
                            {story.paragraphs.map((paragraph, idx) => (
                                <p key={idx} className="first-letter:text-5xl first-letter:font-black first-letter:text-[#d4af37] first-letter:float-left first-letter:mr-2 first-letter:-mt-1">
                                    {paragraph}
                                </p>
                            ))}
                        </div>

                        {/* Moral or Fact Box */}
                        <div className="p-6 sm:p-8 bg-amber-50/50 border-2 border-[#ebd7b1]/60 rounded-3xl relative mb-16">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white border-2 border-[#ebd7b1] rounded-full flex items-center justify-center text-2xl shadow-sm">
                                💡
                            </div>
                            <h4 className="text-center text-xs font-black uppercase tracking-widest text-[#8b5a2b] mb-3 mt-2">
                                The Lesson Takeaway
                            </h4>
                            <p className="text-center text-[#8b5a2b] font-bold text-lg sm:text-xl">
                                {story.moralOrFact}
                            </p>
                        </div>

                        {/* ── INTERACTIVE COMPREHENSION QUIZ ── */}
                        {story.questions && story.questions.length > 0 && (
                            <div className="mt-16 pt-12 border-t border-[#ebd7b1]/50 space-y-12">
                                <div className="text-center">
                                    <span className="text-3xl">🎯</span>
                                    <h3 className="text-2xl font-black text-[#2c3e50] mt-2 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                        Story Challenge!
                                    </h3>
                                    <p className="text-[#34495e]/80 text-sm font-semibold">
                                        Test your knowledge on the lesson focus: <span className="text-blue-600 font-bold">{story.lessonFocus}</span>
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    {story.questions.map((q, qIdx) => {
                                        const selected = selectedAnswers[qIdx];
                                        const showExplanation = revealExplanations[qIdx];
                                        
                                        const normalize = (s: string | undefined) => s ? String(s).replace(/^[a-d][\.\)]\s*/i, '').replace(/[^\w\s]/g, '').trim().toLowerCase() : '';
                                        const isSelectedCorrect = selected && (normalize(selected) === normalize(q.correctAnswer) || normalize(selected).includes(normalize(q.correctAnswer)) || normalize(q.correctAnswer).includes(normalize(selected)));

                                        return (
                                            <div key={qIdx} className="bg-white border border-[#ebd7b1]/60 rounded-3xl p-6 sm:p-8 shadow-sm">
                                                <h4 className="font-bold text-[#2c3e50] text-lg mb-4 flex gap-2">
                                                    <span className="text-[#d4af37] font-black">{qIdx + 1}.</span>
                                                    <span>{q.question}</span>
                                                </h4>

                                                <div className="grid grid-cols-1 gap-3">
                                                    {q.options.map((opt, oIdx) => {
                                                        const isSelected = selected === opt;
                                                        const isCorrect = normalize(opt) === normalize(q.correctAnswer) || normalize(opt).includes(normalize(q.correctAnswer)) || normalize(q.correctAnswer).includes(normalize(opt));
                                                        
                                                        let btnStyle = "border-2 border-slate-100 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300 text-slate-700";
                                                        
                                                        if (selected) {
                                                            if (isCorrect) {
                                                                btnStyle = "border-2 border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md shadow-emerald-500/10";
                                                            } else if (isSelected) {
                                                                btnStyle = "border-2 border-red-500 bg-red-50 text-red-800";
                                                            } else {
                                                                btnStyle = "border-2 border-slate-100 bg-white text-slate-400 opacity-60";
                                                            }
                                                        }

                                                        return (
                                                            <button
                                                                key={oIdx}
                                                                onClick={() => handleSelectOption(qIdx, opt)}
                                                                disabled={!!selected}
                                                                className={`p-4 rounded-2xl text-left font-bold text-base transition-all flex items-center justify-between ${btnStyle} ${!selected ? 'active:scale-[0.99]' : ''}`}
                                                            >
                                                                <span>{opt}</span>
                                                                {selected && isCorrect && (
                                                                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-2">
                                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                    </div>
                                                                )}
                                                                {selected && isSelected && !isCorrect && (
                                                                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0 ml-2">
                                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {showExplanation && (
                                                    <div className={`mt-4 p-4 rounded-2xl border text-sm font-semibold leading-relaxed ${isSelectedCorrect ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-amber-50/50 border-amber-100 text-slate-700'}`}>
                                                        <span className="font-extrabold uppercase text-xs tracking-wider block mb-1">
                                                            {isSelectedCorrect ? '🎯 Super! Correct Answer' : '💡 Let\'s learn why:'}
                                                        </span>
                                                        {q.explanation}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="p-4 sm:p-6 border-t border-[#ebd7b1]/50 bg-[#fdfaf6] shrink-0 text-center">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-10 py-4 rounded-xl bg-[#2c3e50] text-white font-bold text-lg shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Close Book
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StoryReaderModal;
