import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SuggestTopic from './fun-corner/SuggestTopic';
import TriviaGenerator from './fun-corner/TriviaGenerator';
import StoryWeaver from './fun-corner/StoryWeaver';
import DailySparks from './fun-corner/DailySparks';

const FunCorner: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'suggest-topic' | 'trivia' | 'story' | 'sparks'>('suggest-topic');

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* ── Navbar ── */}
            <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shrink-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-y-3">
                    <div className="flex items-center gap-3 w-1/2 md:w-auto">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="font-black text-slate-900 text-lg truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>Fun Corner</span>
                    </div>

                    <div className="flex gap-1 sm:gap-4 order-3 md:order-none w-full md:w-auto justify-center md:absolute md:left-1/2 md:-translate-x-1/2">
                        <button 
                            onClick={() => navigate('/')}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"
                        >
                            My Classes
                        </button>
                        <div className="px-4 py-2 bg-slate-100 rounded-full text-sm font-bold text-slate-900 flex items-center gap-2">
                            Fun Corner 🎈
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 w-1/2 md:w-auto justify-end">
                        <div
                            onClick={logout}
                            title="Sign out"
                            className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600 font-bold text-sm cursor-pointer hover:bg-slate-300 transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
                {/* ── Tabs ── */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('suggest-topic')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'suggest-topic'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                        }`}
                    >
                        💡 Suggest Topic
                    </button>
                    <button
                        onClick={() => setActiveTab('trivia')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'trivia'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                        }`}
                    >
                        🎯 Trivia Generator
                    </button>
                    <button
                        onClick={() => setActiveTab('story')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'story'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                        }`}
                    >
                        📖 Story Weaver
                    </button>
                    <button
                        onClick={() => setActiveTab('sparks')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'sparks'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                        }`}
                    >
                        ⚡ Daily Sparks
                    </button>
                </div>

                {/* ── Content ── */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-6 min-h-[500px]">
                    {activeTab === 'suggest-topic' && <SuggestTopic />}
                    {activeTab === 'trivia' && <TriviaGenerator />}
                    {activeTab === 'story' && <StoryWeaver />}
                    {activeTab === 'sparks' && <DailySparks />}
                </div>
            </main>
        </div>
    );
};

export default FunCorner;
