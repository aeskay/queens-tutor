import React from 'react';
import type { StoryGame } from '../../types';

interface StoryReaderModalProps {
    story: StoryGame;
    onClose: () => void;
}

const StoryReaderModal: React.FC<StoryReaderModalProps> = ({ story, onClose }) => {
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

                        <div className="space-y-6 sm:space-y-8 text-lg sm:text-xl leading-relaxed text-[#34495e]" style={{ fontFamily: 'Georgia, serif' }}>
                            {story.paragraphs.map((paragraph, idx) => (
                                <p key={idx} className="first-letter:text-5xl first-letter:font-black first-letter:text-[#d4af37] first-letter:float-left first-letter:mr-2 first-letter:-mt-1">
                                    {paragraph}
                                </p>
                            ))}
                        </div>

                        {/* Moral or Fact Box */}
                        <div className="mt-16 p-6 sm:p-8 bg-blue-50 border-2 border-blue-100 rounded-3xl relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white border-2 border-blue-200 rounded-full flex items-center justify-center text-2xl shadow-sm">
                                💡
                            </div>
                            <h4 className="text-center text-xs font-black uppercase tracking-widest text-blue-500 mb-3 mt-2">
                                The Lesson
                            </h4>
                            <p className="text-center text-[#2c3e50] font-bold text-lg sm:text-xl">
                                {story.moralOrFact}
                            </p>
                        </div>
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
