import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { StudentData } from '../types';

interface CreateStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: StudentData | null;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ isOpen, onClose, initialData }) => {
    const { user } = useAuth();
    const isEdit = !!initialData;

    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setNotes(initialData.notes || '');
        } else {
            setName('');
            setNotes('');
        }
        setError(null);
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) return;
        setIsSubmitting(true);
        setError(null);
        try {
            if (isEdit && initialData?.id) {
                await updateDoc(doc(db, 'students', initialData.id), {
                    name: name.trim(),
                    notes: notes.trim(),
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'students'), {
                    userId: user.uid,
                    name: name.trim(),
                    notes: notes.trim(),
                    archived: false,
                    createdAt: serverTimestamp(),
                });
            }
            onClose();
        } catch (err) {
            console.error('Error saving student:', err);
            setError('Failed to save. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {isEdit ? 'Edit Student' : 'Add New Student'}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Student Name *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Jane Doe"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Private Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Learning style, strengths, focus areas..."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400 text-sm resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateStudentModal;
