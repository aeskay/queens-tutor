import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

interface CreateClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateClassModal: React.FC<CreateClassModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [className, setClassName] = useState('');
    const [teacherName, setTeacherName] = useState(user?.displayName || '');
    const [studentName, setStudentName] = useState('');
    const [totalLessons, setTotalLessons] = useState(20);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!className.trim() || !user) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'classes'), {
                userId: user.uid,
                name: className,
                teacherName: teacherName,
                studentName: studentName,
                studentCount: 1, // Default to 1 since we have a student name now
                completedLessons: 0,
                totalLessons: totalLessons,
                createdAt: serverTimestamp(),
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error adding class: ", error);
            alert("Failed to create class. Make sure your Firebase project is set up or check console for errors.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                <h2 className="text-2xl font-bold text-blue-900 mb-6 font-display">Create New Class</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Class Name</label>
                        <input
                            type="text"
                            required
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            placeholder="e.g. Year 10 English"
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Student Name</label>
                        <input
                            type="text"
                            required
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            placeholder="e.g. Jane Doe"
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Teacher Name</label>
                            <input
                                type="text"
                                required
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Modules</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={totalLessons}
                                onChange={(e) => setTotalLessons(parseInt(e.target.value) || 20)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-4 px-6 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Class'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateClassModal;
