import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

interface LessonModule {
    dayNumber: number;
    topicTitle: string;
    fiveMinuteSummary: string;
    kidFriendlyExamples: string[];
    completed?: boolean;
    quiz: {
        questions?: QuizQuestion[];
    } | QuizQuestion[];
}

interface LessonDashboardProps {
    lessons: LessonModule[];
    classId?: string;
}

const LessonDashboard: React.FC<LessonDashboardProps> = ({ lessons, classId }) => {
    const [openDay, setOpenDay] = useState<number | null>(1);
    const [updatingDay, setUpdatingDay] = useState<number | null>(null);

    const toggleDay = (day: number) => {
        setOpenDay(openDay === day ? null : day);
    };

    const toggleCompletion = async (dayNumber: number) => {
        if (!classId) return;
        setUpdatingDay(dayNumber);

        try {
            const updatedLessons = lessons.map(lesson => {
                if (lesson.dayNumber === dayNumber) {
                    return { ...lesson, completed: !lesson.completed };
                }
                return lesson;
            });

            const completedCount = updatedLessons.filter(l => l.completed).length;

            await updateDoc(doc(db, 'classes', classId), {
                lessons: updatedLessons,
                completedLessons: completedCount
            });
        } catch (error) {
            console.error("Error updating lesson:", error);
        } finally {
            setUpdatingDay(null);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-8 px-4 pb-20">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center">
                <svg className="w-8 h-8 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                Course Modules
            </h2>
            <div className="space-y-4">
                {lessons.map((lesson) => (
                    <div key={lesson.dayNumber} className={`border rounded-3xl bg-white shadow-sm overflow-hidden transition-all ${lesson.completed ? 'border-green-100' : 'border-gray-100'}`}>
                        <div className="w-full flex items-center">
                            <button
                                onClick={() => toggleDay(lesson.dayNumber)}
                                className="flex-1 text-left p-6 focus:outline-none flex justify-between items-center hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-sm transition-colors ${lesson.completed ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                                        {lesson.completed ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                        ) : lesson.dayNumber}
                                    </span>
                                    <span className={`text-lg font-bold transition-colors ${lesson.completed ? 'text-gray-400' : 'text-gray-800'}`}>
                                        {lesson.topicTitle}
                                    </span>
                                </div>
                                <svg
                                    className={`w-6 h-6 text-gray-400 transition-transform ${openDay === lesson.dayNumber ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div className="pr-6">
                                <button
                                    onClick={() => toggleCompletion(lesson.dayNumber)}
                                    disabled={updatingDay === lesson.dayNumber}
                                    className={`p-2 rounded-xl transition-all ${lesson.completed
                                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                        : 'text-gray-300 hover:text-green-500 hover:bg-gray-50'
                                        }`}
                                    title={lesson.completed ? "Mark as Incomplete" : "Mark as Completed"}
                                >
                                    {updatingDay === lesson.dayNumber ? (
                                        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent animate-spin rounded-full" />
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div
                            className={`transition-all duration-300 ease-in-out ${openDay === lesson.dayNumber ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 invisible'
                                }`}
                        >
                            <div className="p-8 pt-0 border-t border-gray-50">
                                <section className="mt-6 mb-8">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">5-Minute Summary</h4>
                                    <p className="text-gray-600 leading-relaxed text-lg">{lesson.fiveMinuteSummary}</p>
                                </section>

                                <section className="mb-8 p-6 bg-green-50/50 rounded-2xl border border-green-100/30">
                                    <h4 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-4">Classroom Activities</h4>
                                    <ul className="space-y-4">
                                        {(lesson.kidFriendlyExamples || []).map((example, i) => (
                                            <li key={i} className="flex gap-3 text-gray-700">
                                                <span className="text-green-500 font-bold">•</span>
                                                {example}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section>
                                    <h4 className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-4">Quick Assessment</h4>
                                    <div className="grid gap-4">
                                        {(Array.isArray(lesson.quiz) ? lesson.quiz : []).map((q, i) => (
                                            <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="font-bold text-gray-800 mb-4">{q.question}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {q.options.map((option, oi) => (
                                                        <div key={oi} className={`p-3 rounded-xl border text-sm transition-all ${option === q.correctAnswer
                                                            ? 'border-green-200 bg-green-50 text-green-700 font-medium'
                                                            : 'border-gray-100 bg-gray-50 text-gray-500'
                                                            }`}>
                                                            {option}
                                                            {option === q.correctAnswer && <span className="ml-2">✓</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LessonDashboard;
