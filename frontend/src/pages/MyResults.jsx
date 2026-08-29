import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const BANDS = [
    { pct: 90, label: 'Excellent', color: '#1a7a3a', bg: 'rgba(48,209,88,0.1)', emoji: '👑' },
    { pct: 75, label: 'Very Good',  color: '#30d158', bg: 'rgba(48,209,88,0.06)', emoji: '⭐' },
    { pct: 60, label: 'Good',      color: '#6c63ff', bg: 'rgba(108,99,255,0.08)', emoji: '👍' },
    { pct: 45, label: 'Average',   color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)', emoji: '📝' },
    { pct:  0, label: 'Needs work',color: '#ff3b30', bg: 'rgba(255,59,48,0.08)',  emoji: '💪' },
];

const getBand = (score, total) => {
    const pct = total > 0 ? (score / total) * 100 : 0;
    return BANDS.find(b => pct >= b.pct) || BANDS[BANDS.length-1];
};

const MyResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const nav = useNavigate();

    const [selectedSubDetail, setSelectedSubDetail] = useState(null);
    const [expandedQuestions, setExpandedQuestions] = useState([]);

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/api/quiz/my-results`, { headers: { Authorization: `Bearer ${user.token}` } })
            .then(r => setResults(r.data))
            .catch(console.error).finally(() => setLoading(false));
    }, [user.token]);

    const handleViewDetails = async (submissionId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/quiz/submission/${submissionId}`, { headers: { Authorization: `Bearer ${user.token}` } });
            setSelectedSubDetail(res.data.submission);
            setExpandedQuestions(res.data.questions);
        } catch {
            alert('Failed to load submission details');
        }
    };

    const totalAverage = results.length > 0
        ? Math.round(results.reduce((acc, r) => acc + (r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0), 0) / results.length)
        : 0;

    if (loading) return (
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 24 }} />)}
        </div>
    );

    return (
        <div className="page-in" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(24px,5vw,32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>📈 My Progress</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>Review your academic performance</p>
                </div>
                <button className="btn btn-ghost btn-pill" onClick={() => nav('/')} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)' }}>← Dashboard</button>
            </div>

            {results.length > 0 && (
                <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 24, padding: '24px 32px', 
                    background: 'white', borderRadius: 24, marginBottom: 32, 
                    border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 12px 30px rgba(0,0,0,0.03)' 
                }}>
                    <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="72" height="72" viewBox="0 0 72 72">
                            <circle cx="36" cy="36" r="32" fill="none" stroke="#f0f0f5" strokeWidth="8" />
                            <circle cx="36" cy="36" r="32" fill="none" stroke="var(--brand-accent)" strokeWidth="8" strokeDasharray={`${totalAverage * 2}, 200`} strokeLinecap="round" transform="rotate(-90 36 36)" />
                        </svg>
                        <div style={{ position: 'absolute', fontWeight: 800, fontSize: 18, color: '#111' }}>{totalAverage}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Overall Average</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>
                            {totalAverage >= 75 ? 'Outstanding Performance!' : totalAverage >= 50 ? 'Steady Progress' : 'Keep pushing forward!'}
                        </div>
                    </div>
                </div>
            )}

            {results.length === 0 ? (
                <div className="card" style={{ padding: '64px 32px', textAlign: 'center', borderRadius: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Academic record empty</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>Complete your assigned quizzes to see your skills breakdown here.</p>
                    <button className="btn btn-primary" style={{ padding: '14px 40px', borderRadius: 100 }} onClick={() => nav('/')}>Start Learning Now</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {results.map((r, i) => {
                        const band = getBand(r.score, r.totalQuestions);
                        const pct = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                        return (
                            <div key={r._id || i} className="card card-hover" style={{ padding: '24px', borderRadius: 24, cursor: 'pointer', animation: `pageIn 0.5s ease ${i * 0.08}s both` }} onClick={() => handleViewDetails(r._id)}>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{ 
                                        width: 56, height: 56, borderRadius: 18, background: band.bg, 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 
                                    }}>
                                        {band.emoji}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {r.quizId?.title || 'General Quiz'}
                                            </h3>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>
                                                {(() => {
                                                    try {
                                                        return new Date(r.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                    } catch {
                                                        return '';
                                                    }
                                                })()}
                                            </span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ flex: 1, height: 6, background: '#f0f0f5', borderRadius: 10, overflow: 'hidden' }}>
                                                <div style={{ 
                                                    height: '100%', background: band.color, borderRadius: 10,
                                                    width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                                                }} />
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: band.color, minWidth: 40, textAlign: 'right' }}>
                                                {r.score}/{r.totalQuestions}
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: band.bg, color: band.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {band.label}
                                            </span>
                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(0,0,0,0.04)', color: '#666' }}>
                                                {pct}% Accuracy
                                            </span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-accent)', marginLeft: 'auto' }}>
                                                Click to Review Questions →
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submission Details Modal */}
            {selectedSubDetail && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}>
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col anim-up" onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="flex justify-between items-start p-6 sm:p-8 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">{selectedSubDetail.quizId?.title}</h3>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <span className="bg-indigo-50 text-[#6c63ff] px-3 py-1 rounded-full text-xs font-bold">
                                        Score: {selectedSubDetail.score} / {selectedSubDetail.totalQuestions}
                                    </span>
                                    <span className="bg-slate-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                                        Submitted: {new Date(selectedSubDetail.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}
                                className="text-gray-400 hover:text-gray-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer"
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-8 space-y-6">
                            {!selectedSubDetail.quizId?.showCorrectAnswers && !selectedSubDetail.quizId?.showExplanations ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <span className="text-3xl mb-3 block">🔒</span>
                                    <h4 className="text-base font-bold text-gray-800 mb-1">Detailed review locked</h4>
                                    <p className="text-sm text-gray-500 max-w-sm mx-auto">Correct answers and explanations have not been published for this test yet.</p>
                                </div>
                            ) : (
                                expandedQuestions.map((q, idx) => {
                                    const studentAns = selectedSubDetail.answers?.find(a => a.questionId === q._id);
                                    const isStudentCorrect = studentAns && studentAns.selectedOption === q.correctAnswer;
                                    
                                    return (
                                        <div key={q._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
                                            {/* Question Title & Status Badge */}
                                            <div className="flex justify-between items-start gap-4">
                                                <h4 className="text-sm sm:text-base font-extrabold text-gray-900 leading-snug">
                                                    Q{idx + 1}. {q.question}
                                                </h4>
                                                {selectedSubDetail.quizId?.showCorrectAnswers && (
                                                    isStudentCorrect ? (
                                                        <span className="bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0">
                                                            ✓ Correct
                                                        </span>
                                                    ) : (
                                                        <span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0">
                                                            ✗ Incorrect
                                                        </span>
                                                    )
                                                )}
                                            </div>

                                            {/* Question Image */}
                                            {q.image && (
                                                <div className="rounded-xl overflow-hidden border border-slate-100 max-h-60">
                                                    <img src={q.image} alt="Question Graphic" className="w-full h-full object-contain" />
                                                </div>
                                            )}

                                            {/* Options list */}
                                            <div className="grid grid-cols-1 gap-3">
                                                {q.options.map((opt, oIdx) => {
                                                    const isSelected = studentAns?.selectedOption === opt;
                                                    const isCorrectOpt = q.correctAnswer === opt;
                                                    
                                                    let cardStyle = "border-slate-200/80 bg-slate-50 text-slate-700";
                                                    let badgeElement = null;

                                                    if (selectedSubDetail.quizId?.showCorrectAnswers) {
                                                        if (isCorrectOpt) {
                                                            cardStyle = "border-green-200 bg-green-50/70 text-green-800 ring-2 ring-green-500/20";
                                                            badgeElement = <span className="ml-auto bg-green-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Correct Answer</span>;
                                                        } else if (isSelected) {
                                                            cardStyle = "border-red-200 bg-red-50/70 text-red-800 ring-2 ring-red-500/20";
                                                            badgeElement = <span className="ml-auto bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Your Selection</span>;
                                                        }
                                                    } else if (isSelected) {
                                                        cardStyle = "border-[#6c63ff]/30 bg-indigo-50/60 text-indigo-900";
                                                        badgeElement = <span className="ml-auto bg-[#6c63ff] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Selected</span>;
                                                    }

                                                    return (
                                                        <div 
                                                            key={oIdx} 
                                                            className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-semibold transition-all ${cardStyle}`}
                                                        >
                                                            <span className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200/50 flex items-center justify-center text-xs font-bold shadow-sm">
                                                                {['A','B','C','D'][oIdx]}
                                                            </span>
                                                            <span className="flex-1 leading-normal">{opt}</span>
                                                            {badgeElement}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Explanation */}
                                            {selectedSubDetail.quizId?.showExplanations && q.explanation && (
                                                <div className="border-t border-slate-100 pt-4 mt-3 bg-slate-50/50 p-4 rounded-xl space-y-2">
                                                    <span className="text-xs font-extrabold text-[#6c63ff] uppercase tracking-wider">Explanation</span>
                                                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{q.explanation}</p>
                                                    {q.explanationImage && (
                                                        <div className="rounded-xl overflow-hidden border border-slate-100 max-h-48 mt-2">
                                                            <img src={q.explanationImage} alt="Explanation Graphic" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyResults;
