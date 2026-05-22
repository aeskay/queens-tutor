import React, { useState } from 'react';
import type { TriviaGame } from '../../types';

interface TriviaPlayerModalProps {
    game: TriviaGame;
    onClose: () => void;
}

const TriviaPlayerModal: React.FC<TriviaPlayerModalProps> = ({ game, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    const currentQuestion = game.questions[currentIndex];

    const handleSelectOption = (option: string) => {
        if (selectedOption) return; // Prevent changing answer
        setSelectedOption(option);
        if (option === currentQuestion.correctAnswer) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < game.questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
        } else {
            setIsFinished(true);
        }
    };

    // Calculate dynamic color for score
    const scorePercentage = (score / game.questions.length) * 100;
    let scoreColor = 'text-red-500';
    if (scorePercentage >= 70) scoreColor = 'text-emerald-500';
    else if (scorePercentage >= 40) scoreColor = 'text-amber-500';

    if (isFinished) {
        return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl text-center relative overflow-hidden">
                    {/* Confetti decoration */}
                    {scorePercentage >= 70 && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                    )}
                    
                    <h2 className="text-3xl font-black text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Game Over!
                    </h2>
                    <p className="text-slate-500 font-medium mb-8">You finished the "{game.topic}" trivia.</p>
                    
                    <div className="w-40 h-40 mx-auto bg-slate-50 rounded-full flex flex-col items-center justify-center mb-8 border-8 border-slate-100">
                        <span className={`text-5xl font-black ${scoreColor}`}>{score}</span>
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">out of {game.questions.length}</span>
                    </div>

                    <p className="text-lg font-bold text-slate-700 mb-8">
                        {scorePercentage === 100 ? 'Perfect Score! 🏆' : 
                         scorePercentage >= 70 ? 'Great Job! 🌟' : 
                         scorePercentage >= 40 ? 'Good Effort! 👍' : 'Keep Learning! 📚'}
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Close Game
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/95 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] shadow-2xl overflow-hidden relative">
                
                {/* ── Header ── */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white z-10 shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>{game.topic}</h2>
                        <div className="flex gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                            <span>Question {currentIndex + 1} / {game.questions.length}</span>
                            <span>•</span>
                            <span className={scoreColor}>Score: {score}</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* ── Progress Bar ── */}
                <div className="w-full h-1.5 bg-slate-100 shrink-0">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out" 
                        style={{ width: `${((currentIndex) / game.questions.length) * 100}%` }}
                    />
                </div>

                {/* ── Content Area ── */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col">
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-8 leading-tight">
                        {currentQuestion.question}
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-8 flex-1">
                        {currentQuestion.options.map((option, idx) => {
                            const isSelected = selectedOption === option;
                            const isCorrect = option === currentQuestion.correctAnswer;
                            const showStatus = selectedOption !== null; // Reveal answers after selection
                            
                            let buttonStyle = 'bg-white border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700';
                            
                            if (showStatus) {
                                if (isCorrect) {
                                    buttonStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800 shadow-lg shadow-emerald-500/20';
                                } else if (isSelected && !isCorrect) {
                                    buttonStyle = 'bg-red-50 border-2 border-red-500 text-red-800 opacity-80';
                                } else {
                                    buttonStyle = 'bg-white border-2 border-slate-100 text-slate-400 opacity-50';
                                }
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectOption(option)}
                                    disabled={showStatus}
                                    className={`p-4 sm:p-5 rounded-2xl text-left font-bold text-lg transition-all duration-200 flex items-center justify-between ${buttonStyle} ${!showStatus ? 'active:scale-[0.98]' : ''}`}
                                >
                                    <span>{option}</span>
                                    {showStatus && isCorrect && (
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                    {showStatus && isSelected && !isCorrect && (
                                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Fun Fact Area (Revealed after answering) */}
                    {selectedOption && (
                        <div className={`mt-auto p-5 rounded-2xl border ${selectedOption === currentQuestion.correctAnswer ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                            <h4 className={`text-sm font-black uppercase tracking-wider mb-2 flex items-center gap-2 ${selectedOption === currentQuestion.correctAnswer ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {selectedOption === currentQuestion.correctAnswer ? '🎯 Correct!' : '💡 Actually...'}
                            </h4>
                            <p className="text-slate-700 font-medium leading-relaxed">
                                {currentQuestion.funFact}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                {selectedOption && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                        <button
                            onClick={handleNext}
                            className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {currentIndex < game.questions.length - 1 ? 'Next Question' : 'Finish Trivia'}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriviaPlayerModal;
