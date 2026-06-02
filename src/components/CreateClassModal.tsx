import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { StudentData, ClassData } from '../types';

interface CreateClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: ClassData | null;
    students: StudentData[];
    currentStudentId: string | null;
}

function getTodayISO() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(iso: string) {
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

const CreateClassModal: React.FC<CreateClassModalProps> = ({ isOpen, onClose, onSuccess, initialData, students, currentStudentId }) => {
    const { user } = useAuth();
    const isEdit = !!initialData;

    const [className, setClassName] = useState('');
    const [teacherName, setTeacherName] = useState(user?.displayName || '');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [totalLessons, setTotalLessons] = useState(20);
    const [classDate, setClassDate] = useState(getTodayISO());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setClassName(initialData.name || '');
                setTeacherName(initialData.teacherName || '');
                setSelectedStudentId(initialData.studentId || '');
                setTotalLessons(initialData.totalLessons || 20);
                setClassDate(initialData.classDate || getTodayISO());
            } else {
                setClassName('');
                setTeacherName(user?.displayName || '');
                setSelectedStudentId(currentStudentId || '');
                setTotalLessons(20);
                setClassDate(getTodayISO());
            }
            setError(null);
        }
    }, [initialData, user, isOpen, currentStudentId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!className.trim() || !user || !selectedStudentId) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const student = students.find(s => s.id === selectedStudentId);
            const studentName = student?.name || 'Unnamed Student';

            if (isEdit && initialData?.id) {
                await updateDoc(doc(db, 'classes', initialData.id), {
                    name: className.trim(),
                    teacherName: teacherName.trim(),
                    studentId: selectedStudentId,
                    studentName: studentName,
                    totalLessons: Number(totalLessons),
                    classDate: classDate,
                });
            } else {
                await addDoc(collection(db, 'classes'), {
                    userId: user.uid,
                    name: className.trim(),
                    teacherName: teacherName.trim(),
                    studentId: selectedStudentId,
                    studentName: studentName,
                    studentCount: 1,
                    completedLessons: 0,
                    status: 'in-progress',
                    totalLessons: Number(totalLessons),
                    classDate: classDate,
                    createdAt: serverTimestamp(),
                });
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving class:', err);
            setError('Failed to save. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {isEdit ? 'Edit Class' : 'Create New Class'}
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Class Name *</label>
                        <input
                            type="text"
                            required
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            placeholder="e.g. Year 10 English"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Student *</label>
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
                        {students.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Please create a student first.</p>
                        )}
                    </div>

                    {/* Class Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Class Date
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={classDate}
                                onChange={(e) => setClassDate(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 text-sm"
                            />
                            {classDate && (
                                <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-500 pointer-events-none">
                                    {formatDateDisplay(classDate)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Teacher</label>
                            <input
                                type="text"
                                required
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">No. of Lessons</label>
                            <input
                                type="number"
                                required
                                min="0"
                                max="100"
                                value={totalLessons}
                                onChange={(e) => setTotalLessons(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white focus:outline-none transition-all font-medium text-slate-900 text-sm"
                            />
                            {totalLessons === 0 && (
                                <p className="text-xs text-blue-500 mt-1.5 font-medium">
                                    You can add modules manually inside the class.
                                </p>
                            )}
                        </div>
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
                            disabled={isSubmitting || students.length === 0}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Class'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateClassModal;
