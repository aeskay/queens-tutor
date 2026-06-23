import React, { useState } from 'react';
import { useSavedBooks } from '../../hooks/useSavedBooks';

const SavedBooks: React.FC = () => {
    const { savedBooks, loading, removeBook, getLists } = useSavedBooks();
    
    const [selectedList, setSelectedList] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    const lists = ['All', ...getLists()];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 font-medium animate-pulse">Loading your library...</p>
            </div>
        );
    }

    if (savedBooks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">
                    📚
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Your library is empty</h3>
                <p className="text-sm text-slate-500">
                    When you find textbooks you like, click the "💾 Save" button to keep them organized here.
                </p>
            </div>
        );
    }

    // Filter and sort logic
    let filtered = savedBooks;
    if (selectedList !== 'All') {
        filtered = filtered.filter(b => b.listName === selectedList);
    }
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.authors.toLowerCase().includes(q)
        );
    }
    
    filtered.sort((a, b) => {
        const tA = a.savedAt?.getTime() || 0;
        const tB = b.savedAt?.getTime() || 0;
        return sortOrder === 'newest' ? tB - tA : tA - tB;
    });

    const handleGoogleSearch = (query: string) => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    const handleArchiveSearch = (title: string, authors: string) => {
        const q = `${title} ${authors}`.trim();
        window.open(`https://archive.org/search?query=${encodeURIComponent(q)}&mediatype=texts`, '_blank');
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Filters Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 relative">
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                        type="text" 
                        placeholder="Search saved books..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <select 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-semibold text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {lists.map(list => (
                    <button
                        key={list}
                        onClick={() => setSelectedList(list)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${
                            selectedList === list 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/25' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {list === 'All' ? '📚 All Books' : `📂 ${list}`}
                    </button>
                ))}
            </div>

            {/* Empty State for Filter */}
            {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm font-medium">
                    No books match your search/filter.
                </div>
            )}

            {/* Books Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((book) => (
                    <div 
                        key={book.id} 
                        className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-slate-200/60 transition-all flex flex-col overflow-hidden relative group"
                    >
                        {/* List Badge & Date */}
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-100/50 px-2.5 py-1 rounded-md">
                                {book.listName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                                {book.savedAt?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>

                        <div className="p-5 flex flex-col flex-1">
                            <h3 className="font-black text-slate-900 leading-tight mb-1 pr-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                {book.title}
                            </h3>
                            
                            <button 
                                onClick={() => removeBook(book.id)}
                                title="Remove from list"
                                className="absolute top-12 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            <p className="text-xs text-slate-400 font-semibold mb-1">{book.authors}</p>
                            {book.edition && book.edition !== 'N/A' && (
                                <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md mb-3">
                                    {book.edition}
                                </span>
                            )}

                            <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">
                                {book.description}
                            </p>

                            {/* Action buttons */}
                            <div className="flex flex-col gap-2 mt-auto">
                                <button
                                    onClick={() => {
                                        const baseQuery = (book.pdfSearchQuery || `${book.title} ${book.authors}`)
                                            .replace(/\bsite:\S+/gi, '')
                                            .replace(/\bfiletype:\S+/gi, '')
                                            .trim();
                                        handleGoogleSearch(`${baseQuery} filetype:pdf`);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-all active:scale-95"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    Search Free PDF
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleArchiveSearch(book.title, book.authors)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition-all border border-amber-200"
                                    >
                                        🗃️ Archive.org
                                    </button>
                                    {book.openLibraryUrl && (
                                        <a
                                            href={book.openLibraryUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all border border-blue-200 text-center"
                                        >
                                            📖 Open Library
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SavedBooks;
