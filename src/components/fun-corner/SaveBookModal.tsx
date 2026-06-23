import React, { useState } from 'react';
import { useSavedBooks } from '../../hooks/useSavedBooks';

interface SaveBookModalProps {
    book: any;
    onClose: () => void;
}

const SaveBookModal: React.FC<SaveBookModalProps> = ({ book, onClose }) => {
    const { savedBooks, saveBook, getLists } = useSavedBooks();
    const lists = getLists();
    
    // Check if book already exists in any list
    const existingEntries = savedBooks.filter(b => b.title.toLowerCase() === book.title.toLowerCase());
    const isDuplicate = existingEntries.length > 0;

    const [isNewList, setIsNewList] = useState(lists.length === 0);
    const [selectedList, setSelectedList] = useState(lists.length > 0 ? lists[0] : '');
    const [newListName, setNewListName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const listToUse = isNewList ? newListName.trim() : selectedList;
        if (!listToUse) return;

        setIsSaving(true);
        try {
            await saveBook({
                listName: listToUse,
                title: book.title,
                authors: book.authors,
                edition: book.edition || 'N/A',
                description: book.description,
                curriculumNote: book.curriculumNote || '',
                pdfSearchQuery: book.pdfSearchQuery || '',
                openLibraryUrl: book.openLibraryUrl || ''
            });
            onClose();
        } catch (error) {
            console.error("Failed to save book", error);
            alert("Failed to save book. Please try again.");
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            💾 Save Textbook
                        </h3>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <h4 className="font-bold text-slate-800 leading-tight mb-1">{book.title}</h4>
                        <p className="text-xs text-slate-500 font-medium">{book.authors}</p>
                    </div>

                    {isDuplicate && (
                        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                            <span className="text-amber-500 text-lg">⚠️</span>
                            <p className="text-xs text-amber-800 font-medium">
                                You already have this book saved in: <br/>
                                <span className="font-bold">{existingEntries.map(e => e.listName).join(', ')}</span>.<br/>
                                You can still save it to another list if you want to!
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Select Category / List</label>
                        
                        {lists.length > 0 && (
                            <div className="flex items-center gap-4 mb-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        checked={!isNewList} 
                                        onChange={() => setIsNewList(false)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    Existing List
                                </label>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        checked={isNewList} 
                                        onChange={() => setIsNewList(true)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    New List
                                </label>
                            </div>
                        )}

                        {!isNewList && lists.length > 0 ? (
                            <div className="relative">
                                <select 
                                    value={selectedList}
                                    onChange={(e) => setSelectedList(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-semibold text-slate-700 appearance-none cursor-pointer"
                                >
                                    {lists.map(list => (
                                        <option key={list} value={list}>{list}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        ) : (
                            <input 
                                type="text"
                                placeholder="e.g. Physics Prep, To Read..."
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium"
                                autoFocus
                            />
                        )}
                    </div>

                    <div className="mt-8">
                        <button 
                            onClick={handleSave}
                            disabled={isSaving || (isNewList && !newListName.trim())}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>💾 Save to {isNewList ? 'New List' : 'List'}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaveBookModal;
