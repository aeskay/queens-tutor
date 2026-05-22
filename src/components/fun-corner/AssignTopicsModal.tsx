import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { TopicSuggestion, StudentData, ClassData } from '../../types';

interface AssignTopicsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTopics: TopicSuggestion[];
    onAssignSuccess: () => void;
}

const AssignTopicsModal: React.FC<AssignTopicsModalProps> = ({ isOpen, onClose, selectedTopics, onAssignSuccess }) => {
    const { user } = useAuth();
    const [students, setStudents] = useState<StudentData[]>([]);
    const [classesByStudent, setClassesByStudent] = useState<Record<string, ClassData[]>>({});
    
    // State for assignments: studentId -> { classId: string, newClassName: string }
    const [assignments, setAssignments] = useState<Record<string, { classId: string, newClassName: string }>>({});
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !isOpen) return;
        const fetchStudentsAndClasses = async () => {
            try {
                // Fetch Students
                const sQuery = query(collection(db, 'students'), where('userId', '==', user.uid));
                const sSnapshot = await getDocs(sQuery);
                const sData = sSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentData)).filter(s => !s.archived);
                setStudents(sData);

                // Fetch Classes for these students
                const cQuery = query(collection(db, 'classes'), where('userId', '==', user.uid));
                const cSnapshot = await getDocs(cQuery);
                const cData = cSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassData));
                
                const classesMap: Record<string, ClassData[]> = {};
                sData.forEach(s => {
                    classesMap[s.id] = cData.filter(c => c.studentId === s.id);
                });
                setClassesByStudent(classesMap);
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        };
        fetchStudentsAndClasses();
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleToggleStudent = (studentId: string) => {
        setAssignments(prev => {
            const next = { ...prev };
            if (next[studentId]) {
                delete next[studentId]; // Deselect
            } else {
                next[studentId] = { classId: '', newClassName: '' }; // Select with no class yet
            }
            return next;
        });
    };

    const handleClassSelection = (studentId: string, value: string) => {
        setAssignments(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], classId: value }
        }));
    };

    const handleNewClassName = (studentId: string, name: string) => {
        setAssignments(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], newClassName: name }
        }));
    };

    const isFormValid = () => {
        const selectedStudentIds = Object.keys(assignments);
        if (selectedStudentIds.length === 0) return false;
        
        // Every selected student must have a valid class selection
        return selectedStudentIds.every(id => {
            const assign = assignments[id];
            if (assign.classId === 'new') return assign.newClassName.trim().length > 0;
            return assign.classId.length > 0;
        });
    };

    const handleConfirm = async () => {
        if (!isFormValid() || !user) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const selectedStudentIds = Object.keys(assignments);

            for (const studentId of selectedStudentIds) {
                const assign = assignments[studentId];
                const student = students.find(s => s.id === studentId);
                if (!student) continue;

                let targetClassId = assign.classId;

                // Create new class if requested
                if (targetClassId === 'new') {
                    const newClassRef = await addDoc(collection(db, 'classes'), {
                        userId: user.uid,
                        name: assign.newClassName.trim(),
                        teacherName: user.displayName || 'Teacher',
                        studentId: student.id,
                        studentName: student.name,
                        studentCount: 1,
                        completedLessons: 0,
                        status: 'in-progress',
                        totalLessons: selectedTopics.length,
                        createdAt: serverTimestamp(),
                        lessons: []
                    });
                    targetClassId = newClassRef.id;
                }

                // Add modules as "Generating..."
                const classRef = doc(db, 'classes', targetClassId);
                const classDoc = await getDoc(classRef);
                const classData = classDoc.data() as ClassData;
                
                const existingLessons = classData.lessons || [];
                let nextDayNumber = existingLessons.length > 0 ? Math.max(...existingLessons.map(l => l.dayNumber || 0)) + 1 : 1;
                
                const newLessons = selectedTopics.map(topic => ({
                    id: Math.random().toString(36).substring(2, 11),
                    dayNumber: nextDayNumber++,
                    topicTitle: topic.topicTitle,
                    fiveMinuteSummary: topic.summary,
                    completed: false,
                    detailedLesson: 'Generating...',
                    kidFriendlyExamples: ['Generating...'],
                    quiz: { questions: [] }
                }));

                const allLessons = [...existingLessons, ...newLessons];

                await updateDoc(classRef, {
                    lessons: allLessons,
                    totalLessons: allLessons.length
                });

                // Fire off background generation for these new lessons
                // We don't await this so the modal can close immediately
                generateContentForLessons(targetClassId, newLessons);
            }

            onAssignSuccess();
        } catch (err: any) {
            console.error("Assignment error:", err);
            setError(err.message || 'Failed to assign topics.');
            setIsSubmitting(false);
        }
    };

    // Background generator
    const generateContentForLessons = async (classId: string, lessonsToGenerate: any[]) => {
        for (const lesson of lessonsToGenerate) {
            try {
                // Call generate-lessons endpoint with totalLessons=1 and the topic text as context
                const contextText = `Topic: ${lesson.topicTitle}\nSummary: ${lesson.fiveMinuteSummary}`;
                
                const response = await fetch('/.netlify/functions/generate-lessons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: contextText,
                        totalLessons: 1
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const generatedData = data[0];
                        
                        // Update the specific lesson in Firestore
                        const classRef = doc(db, 'classes', classId);
                        const classDoc = await getDoc(classRef);
                        const currentLessons = classDoc.data()?.lessons || [];
                        
                        const updatedLessons = currentLessons.map((l: any) => {
                            if (l.id === lesson.id) {
                                return {
                                    ...l,
                                    fiveMinuteSummary: generatedData.fiveMinuteSummary || generatedData.summary || 'Summary generated.',
                                    detailedLesson: generatedData.detailedLesson || 'Generated successfully.',
                                    kidFriendlyExamples: generatedData.kidFriendlyExamples || generatedData.classroomActivities || ['Activities generated.'],
                                    quiz: generatedData.quiz || generatedData.knowledgeCheck || { questions: [] }
                                };
                            }
                            return l;
                        });

                        await updateDoc(classRef, { lessons: updatedLessons });
                    }
                }
            } catch (err) {
                console.error(`Failed to generate content for lesson ${lesson.topicTitle}:`, err);
                // Could update Firestore to say "Failed to generate" if we wanted to
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Assign {selectedTopics.length} Topic{selectedTopics.length !== 1 ? 's' : ''}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="mb-6">
                    <p className="text-sm font-semibold text-slate-600 mb-2">Selected Topics:</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedTopics.map(t => (
                            <span key={t.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                                {t.topicTitle}
                            </span>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">1. Select Students</h3>
                    {students.length === 0 ? (
                        <p className="text-sm text-red-500">You need to create a student first.</p>
                    ) : (
                        <div className="space-y-4">
                            {students.map(student => {
                                const isSelected = !!assignments[student.id];
                                return (
                                    <div key={student.id} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-500 bg-slate-50' : 'border-slate-100 hover:border-blue-200'}`}>
                                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleStudent(student.id)}
                                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                            />
                                            <span className="font-bold text-slate-800">{student.name}</span>
                                        </label>

                                        {isSelected && (
                                            <div className="ml-8 mt-3 space-y-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Select Class for {student.name}</label>
                                                    <select
                                                        value={assignments[student.id].classId}
                                                        onChange={(e) => handleClassSelection(student.id, e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none"
                                                    >
                                                        <option value="" disabled>Choose a class...</option>
                                                        {(classesByStudent[student.id] || []).map(cls => (
                                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                        ))}
                                                        <option value="new">+ Create New Class</option>
                                                    </select>
                                                </div>

                                                {assignments[student.id].classId === 'new' && (
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">New Class Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Science Adventures"
                                                            value={assignments[student.id].newClassName}
                                                            onChange={(e) => handleNewClassName(student.id, e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || !isFormValid()}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignTopicsModal;
