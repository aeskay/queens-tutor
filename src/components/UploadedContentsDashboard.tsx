import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ClassData, UploadedContent } from '../types';
import { extractTextFromMultiplePDFs } from '../utils/pdfExtractor';

interface Props {
    classData: ClassData;
    onClose?: () => void;
}

const UploadedContentsDashboard: React.FC<Props> = ({ classData }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contents = classData.uploadedContents || [];

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsUploading(true);
        setError(null);

        try {
            const files = Array.from(e.target.files);
            const newContents: UploadedContent[] = [];
            let combinedNewText = '';

            for (const file of files) {
                // Extract text locally
                const text = await extractTextFromMultiplePDFs([file]);
                combinedNewText += '\n\n' + text;

                // Generate summary — don't let one file's failure abort the rest
                let title = file.name;
                let summary = 'Content extracted from PDF.';
                try {
                    const response = await fetch('/.netlify/functions/generate-summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: text.substring(0, 1500),
                            filename: file.name
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        title = data.title || file.name;
                        summary = data.summary || 'Content extracted from PDF.';
                    } else {
                        console.warn(`Summary generation failed for ${file.name} (status ${response.status}), using defaults.`);
                    }
                } catch (summaryErr) {
                    console.warn(`Summary fetch error for ${file.name}:`, summaryErr);
                }

                newContents.push({
                    id: Math.random().toString(36).substring(2, 11),
                    title,
                    summary,
                    createdAt: new Date().toISOString(),
                    text
                });
            }

            const updatedContents = [...contents, ...newContents];
            const updatedSyllabusText = (classData.syllabusText || '') + combinedNewText;

            await updateDoc(doc(db, 'classes', classData.id), {
                uploadedContents: updatedContents,
                syllabusText: updatedSyllabusText
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error uploading files');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this uploaded content? Existing modules will not be affected, but future generated modules will not use this context.')) return;
        
        try {
            const updatedContents = contents.filter(c => c.id !== id);
            
            // Rebuild syllabus text from remaining contents
            const newSyllabusText = updatedContents.map(c => c.text).join('\n\n');

            await updateDoc(doc(db, 'classes', classData.id), {
                uploadedContents: updatedContents,
                syllabusText: newSyllabusText
            });
        } catch (err: any) {
            setError('Failed to delete content.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-16 pt-6 sm:pt-10 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Uploaded Contents
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm max-w-xl">
                        These documents form the knowledge base for this class. Whenever you add new modules or click Generate, the AI reads through these contents to create the lesson.
                    </p>
                </div>
                
                <label className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm uppercase tracking-wide cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                    {isUploading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                            Add PDFs
                        </>
                    )}
                    <input type="file" multiple accept=".pdf" className="hidden" onChange={handleUpload} disabled={isUploading} />
                </label>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-semibold border border-red-100 flex justify-between items-center">
                    {error}
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            {contents.length === 0 && !isUploading ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1">No documents uploaded</h3>
                    <p className="text-slate-500 text-sm">Upload your syllabus, curriculum, or reading materials to get started.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                    {contents.map((content) => (
                        <div key={content.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-colors shadow-sm group">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 2v20h14V8l-6-6H8zm2 2h5v5h5v11H10V4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 leading-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                            {content.title}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {new Date(content.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(content.id)}
                                    className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                    title="Delete document"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                            <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                {content.summary}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UploadedContentsDashboard;
