import React from 'react';
import { useNavigate } from 'react-router-dom';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ClassData } from '../types';

interface ClassCardProps {
    cls: ClassData;
    accent: { gradient: string; icon: string; badge: string };
    onEdit: (e: React.MouseEvent, cls: ClassData) => void;
    onClone: (e: React.MouseEvent, cls: ClassData) => void;
    onDelete: (e: React.MouseEvent, classId: string) => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ cls, accent, onEdit, onClone, onDelete }) => {
    const navigate = useNavigate();
    
    // Auto calculate if no manual status is set
    const pct = cls.totalLessons > 0 ? Math.min(100, Math.round(((cls.completedLessons || 0) / cls.totalLessons) * 100)) : 0;
    const isCompleted = cls.status === 'completed' || (cls.status !== 'in-progress' && pct >= 100);

    const toggleStatus = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, 'classes', cls.id), {
                status: isCompleted ? 'in-progress' : 'completed'
            });
        } catch (err) {
            console.error('Error updating status', err);
        }
    };

    return (
        <div
            onClick={() => navigate(`/class/${cls.id}`)}
            className={`bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all group cursor-pointer overflow-hidden flex flex-col ${isCompleted ? 'opacity-75 hover:opacity-100' : ''}`}
        >
            <div className={`h-1.5 w-full bg-gradient-to-r ${accent.gradient}`} />
            
            <div className="p-6 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-11 h-11 ${isCompleted ? 'bg-emerald-50 text-emerald-600' : accent.icon} rounded-2xl flex items-center justify-center transition-colors`}>
                        {isCompleted ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={toggleStatus} title={isCompleted ? "Mark In Progress" : "Mark Completed"} className={`p-1.5 rounded-lg transition-all ${isCompleted ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            {isCompleted ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            )}
                        </button>
                        <button onClick={(e) => onEdit(e, cls)} title="Edit" className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={(e) => onClone(e, cls)} title="Clone" className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                        </button>
                        <button onClick={(e) => onDelete(e, cls.id)} title="Delete" className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>

                <h3 className={`text-lg font-black mb-1 group-hover:text-blue-600 transition-colors leading-tight ${isCompleted ? 'text-slate-700 line-through decoration-slate-300' : 'text-slate-900'}`} style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {cls.name}
                </h3>
                <p className="text-xs text-slate-400 mb-1">
                    Teacher: {cls.teacherName}
                </p>
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                    <p className="text-xs text-slate-400 font-medium">
                        Student: {cls.studentName || 'Unassigned'}
                    </p>
                    {cls.classDate && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {(() => {
                                const [y, m, d] = cls.classDate.split('-');
                                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
                            })()}
                        </span>
                    )}
                </div>

                <div className="mt-auto">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-slate-500">{isCompleted ? 'Completed' : 'Progress'}</span>
                        <span className="text-xs font-bold text-slate-700">{isCompleted ? '100%' : `${pct}%`}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : `bg-gradient-to-r ${accent.gradient}`}`}
                            style={{ width: isCompleted ? '100%' : `${pct}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {cls.completedLessons || 0} / {cls.totalLessons} lessons complete
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ClassCard;
