import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ClassData, StudentData } from '../types';

interface CloneClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    classToClone: ClassData | null;
    students: StudentData[];
    currentStudentId: string | null;
}

const CloneClassModal: React.FC<CloneClassModalProps> = ({ isOpen, onClose, classToClone, students, currentStudentId }) => {
    const [selectedStudentId, setSelectedStudentId] = useState<string>(currentStudentId || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen && currentStudentId) {
            setSelectedStudentId(currentStudentId);
        }
    }, [isOpen, currentStudentId]);

    if (!isOpen || !classToClone) return null;

    const handleClone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId) {
            setError('Please select a student to clone to.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const student = students.find(s => s.id === selectedStudentId);
            const studentName = student?.name || classToClone.studentName || 'Unnamed Student';

            const { id: _oldId, ...restOfClass } = classToClone;

            await addDoc(collection(db, 'classes'), {
                ...restOfClass,
                name: `${classToClone.name} (Copy)`,
                studentId: selectedStudentId,
                studentName: studentName,
                completedLessons: 0,
                status: 'in-progress',
                createdAt: serverTimestamp(),
                lessons: classToClone.lessons?.map(l => ({ ...l, completed: false })) || null,
            });

            onClose();
        } catch (err) {
            console.error('Error cloning class:', err);
            setError('Failed to clone class. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Clone Class
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <p className="text-sm text-slate-500 mb-6">
                    You are cloning <strong>{classToClone.name}</strong>. The new copy will have progress reset to 0%. Which student should this copy belong to?
                </p>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleClone} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Target Student *</label>
                        <select
                            required
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 text-sm"
                        >
                            <option value="" disabled>Select a student...</option>
                            {students.filter(s => !s.archived).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedStudentId}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isSubmitting ? 'Cloning...' : 'Confirm Clone'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloneClassModal;
