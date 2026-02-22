import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LessonDashboard from './LessonDashboard';
import { extractTextFromMultiplePDFs } from '../utils/pdfExtractor';

const ClassDetail: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();
    const [classData, setClassData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!classId) return;

        const unsubscribe = onSnapshot(doc(db, 'classes', classId), (docSnap) => {
            if (docSnap.exists()) {
                setClassData({ id: docSnap.id, ...docSnap.data() });
            } else {
                setError("Class not found");
            }
            setLoading(false);
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [classId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleGenerate = async () => {
        if (files.length === 0 || !classId) return;
        setIsGenerating(true);
        setError(null);

        try {
            const extractedText = await extractTextFromMultiplePDFs(files);

            const response = await fetch('/.netlify/functions/generate-lessons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: extractedText,
                    totalLessons: classData.totalLessons || 20
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.details
                    ? `AI Failure Details:\n${errorData.details.join('\n')}`
                    : (errorData.error || 'Failed to generate lesson plan');
                throw new Error(errorMessage);
            }

            const lessons = await response.json();

            // Save lessons to Firestore
            await updateDoc(doc(db, 'classes', classId), {
                lessons: lessons,
                lastGenerated: new Date().toISOString()
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred during generation.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading class...</div>;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 py-10">
            <button
                onClick={() => navigate('/')}
                className="mb-6 flex items-center text-gray-500 hover:text-blue-600 transition-colors gap-2 font-medium"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Dashboard
            </button>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-8">
                <h1 className="text-3xl font-bold text-blue-900 mb-2">{classData.name}</h1>
                <div className="flex flex-col">
                    <p className="text-gray-500 font-medium">Student: {classData.studentName || 'Not set'}</p>
                    <p className="text-sm text-gray-400 font-medium">Teacher: {classData.teacherName}</p>
                </div>
            </div>

            {classData.lessons ? (
                <LessonDashboard lessons={classData.lessons} classId={classId} />
            ) : (
                <div className="bg-blue-50/50 rounded-3xl p-10 border border-blue-100/50 text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-blue-900 mb-4">No Lesson Plan Yet</h2>
                    <p className="text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
                        Upload your syllabus PDFs to generate a custom {classData.totalLessons || 20}-day module with AI.
                    </p>

                    <div className="flex flex-col items-center gap-4">
                        <label className="cursor-pointer bg-white border-2 border-dashed border-blue-200 hover:border-blue-400 p-6 rounded-2xl transition-all w-full max-w-md">
                            <input
                                type="file"
                                multiple
                                accept=".pdf"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <span className="text-blue-600 font-bold">
                                {files.length > 0 ? `${files.length} files selected` : 'Select PDF Files'}
                            </span>
                        </label>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || files.length === 0}
                            className="w-full max-w-md py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {isGenerating ? 'Analyzing PDFs...' : `Generate ${classData.totalLessons || 20}-Day Plan`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassDetail;
