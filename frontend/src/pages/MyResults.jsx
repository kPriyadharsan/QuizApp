import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    // Detect screen size dynamically for fully responsive inline styling
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 24 }} />)}
        </div>
    );

    return (
        <div 
            className="page-in" 
            style={{ 
                maxWidth: '720px', 
                margin: '0 auto', 
                padding: isMobile ? '16px 16px 60px 16px' : '32px 24px 80px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
            }}
        >
            {/* Header section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ textAlign: isMobile ? 'center' : 'left', width: isMobile ? '100%' : 'auto' }}>
                    <h1 style={{ fontSize: 'clamp(24px,5vw,32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px' }}>📈 My Progress</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', margin: 0 }}>Review your academic performance</p>
                </div>
                <button 
                    className="btn btn-ghost btn-pill" 
                    onClick={() => nav('/')} 
                    style={{ 
                        background: 'white', 
                        border: '1px solid rgba(0,0,0,0.08)', 
                        padding: '8px 20px', 
                        borderRadius: '100px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        margin: isMobile ? '12px auto 0 auto' : '0'
                    }}
                >
                    ← Dashboard
                </button>
            </div>

            {/* Overall stats widget */}
            {results.length > 0 && (
                <div 
                    style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: 'center',
                        textAlign: isMobile ? 'center' : 'left',
                        gap: '20px',
                        padding: isMobile ? '24px 20px' : '24px 32px',
                        background: '#ffffff',
                        borderRadius: '24px',
                        border: '1px solid rgba(0,0,0,0.04)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.02)'
                    }}
                >
                    <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="72" height="72" viewBox="0 0 72 72">
                            <circle cx="36" cy="36" r="32" fill="none" stroke="#f0f0f5" strokeWidth="8" />
                            <circle cx="36" cy="36" r="32" fill="none" stroke="var(--brand-accent)" strokeWidth="8" strokeDasharray={`${totalAverage * 2}, 200`} strokeLinecap="round" transform="rotate(-90 36 36)" />
                        </svg>
                        <div style={{ position: 'absolute', fontWeight: 800, fontSize: '18px', color: '#111' }}>{totalAverage}%</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Average</div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: '#1c1c1e' }}>
                            {totalAverage >= 75 ? 'Outstanding Performance! 👑' : totalAverage >= 50 ? 'Steady Progress ⭐' : 'Keep pushing forward! 💪'}
                        </div>
                    </div>
                </div>
            )}

            {/* Quizzes List */}
            {results.length === 0 ? (
                <div className="card" style={{ padding: '64px 24px', textAlign: 'center', borderRadius: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Academic record empty</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '32px', maxWidth: '360px', margin: '0 auto 32px' }}>Complete your assigned quizzes to see your skills breakdown here.</p>
                    <button className="btn btn-primary" style={{ padding: '14px 40px', borderRadius: '100px', cursor: 'pointer' }} onClick={() => nav('/')}>Start Learning Now</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {results.map((r, i) => {
                        const band = getBand(r.score, r.totalQuestions);
                        const pct = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                        return (
                            <div 
                                key={r._id || i} 
                                className="card card-hover" 
                                style={{ 
                                    padding: isMobile ? '20px' : '24px', 
                                    borderRadius: '24px', 
                                    cursor: 'pointer', 
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: isMobile ? 'center' : 'flex-start',
                                    textAlign: isMobile ? 'center' : 'left',
                                    gap: isMobile ? '16px' : '20px',
                                    border: '1px solid rgba(0,0,0,0.04)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                                    transition: 'all 0.2s ease',
                                    animation: `pageIn 0.5s ease ${i * 0.08}s both`
                                }} 
                                onClick={() => handleViewDetails(r._id)}
                            >
                                <div 
                                    style={{ 
                                        width: '56px', 
                                        height: '56px', 
                                        borderRadius: '16px', 
                                        background: band.bg, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        fontSize: '24px',
                                        flexShrink: 0
                                    }}
                                >
                                    {band.emoji}
                                </div>
                                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111', margin: 0, lineHeight: '1.4' }}>
                                            {r.quizId?.title || 'General Quiz'}
                                        </h3>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                                            {(() => {
                                                try {
                                                    return new Date(r.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                } catch {
                                                    return '';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                        <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                background: band.color, 
                                                borderRadius: '10px',
                                                width: `${pct}%`, 
                                                transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 800, color: band.color, minWidth: '45px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {r.score} / {r.totalQuestions}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: '8px', marginTop: '4px', width: '100%' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '100px', background: band.bg, color: band.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            {band.label}
                                        </span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(0,0,0,0.04)', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            {pct}% Accuracy
                                        </span>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-accent)', marginLeft: isMobile ? '0' : 'auto', marginTop: isMobile ? '6px' : '0', display: 'block', width: isMobile ? '100%' : 'auto', textAlign: 'center' }}>
                                            Click to Review Questions →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submission Details Modal - Rendered via Portal to body to cover the entire viewport */}
            {selectedSubDetail && createPortal(
                <div 
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}
                >
                    <div 
                        style={{
                            background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '640px',
                            maxHeight: isMobile ? '82dvh' : '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(0,0,0,0.05)',
                            position: 'relative'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        
                        {/* Modal Header */}
                        <div 
                            style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                padding: isMobile ? '20px 16px' : '24px 24px 20px', borderBottom: '1px solid #f1f5f9',
                                position: 'sticky', top: 0, background: '#ffffff', zIndex: 10
                            }}
                        >
                            <div style={{ paddingRight: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', lineHeight: '1.3' }}>
                                    {selectedSubDetail.quizId?.title}
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                    <span style={{ background: '#eef2ff', color: '#6c63ff', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>
                                        Score: {selectedSubDetail.score} / {selectedSubDetail.totalQuestions}
                                    </span>
                                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 600 }}>
                                        Submitted: {new Date(selectedSubDetail.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}
                                style={{
                                    border: 'none', background: '#f8fafc', color: '#94a3b8', width: '32px', height: '32px',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s', outline: 'none', flexShrink: 0
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: isMobile ? '16px 16px 120px 16px' : '24px 24px 48px 24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
                            {!selectedSubDetail.quizId?.showCorrectAnswers && !selectedSubDetail.quizId?.showExplanations ? (
                                <div style={{ padding: isMobile ? '24px 16px' : '36px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '32px' }}>🔒</span>
                                    <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Detailed review locked</h4>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, maxWidth: '280px', lineHeight: '1.5' }}>Correct answers and explanations have not been published for this test yet.</p>
                                </div>
                            ) : (
                                expandedQuestions.map((q, idx) => {
                                    const studentAns = selectedSubDetail.answers?.find(a => a.questionId === q._id);
                                    const isStudentCorrect = studentAns && studentAns.selectedOption === q.correctAnswer;
                                    
                                    return (
                                        <div key={q._id} style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
                                            {/* Question Title & Status Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, lineHeight: '1.4' }}>
                                                    Q{idx + 1}. {q.question}
                                                </h4>
                                                {selectedSubDetail.quizId?.showCorrectAnswers && (
                                                    isStudentCorrect ? (
                                                        <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            ✓ Correct
                                                        </span>
                                                    ) : (
                                                        <span style={{ background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            ✗ Incorrect
                                                        </span>
                                                    )
                                                )}
                                            </div>

                                            {/* Question Image */}
                                            {q.image && (
                                                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9', maxHeight: '240px', background: '#f8fafc', padding: '8px', display: 'flex', justifyContent: 'center' }}>
                                                    <img src={q.image} alt="Question Graphic" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                </div>
                                            )}

                                            {/* Options list */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {q.options.map((opt, oIdx) => {
                                                    const isSelected = studentAns?.selectedOption === opt;
                                                    const isCorrectOpt = q.correctAnswer === opt;
                                                    
                                                    let borderCol = '#e2e8f0';
                                                    let bgCol = '#f8fafc';
                                                    let textCol = '#334155';
                                                    let extraStyle = {};
                                                    let badgeElement = null;

                                                    if (selectedSubDetail.quizId?.showCorrectAnswers) {
                                                        if (isCorrectOpt) {
                                                            borderCol = '#a7f3d0';
                                                            bgCol = '#ecfdf5';
                                                            textCol = '#065f46';
                                                            extraStyle = { boxShadow: '0 0 0 2px rgba(16,185,129,0.1)' };
                                                            badgeElement = <span style={{ marginLeft: 'auto', background: '#10b981', color: '#ffffff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: '2px' }}>Correct Answer</span>;
                                                        } else if (isSelected) {
                                                            borderCol = '#fca5a5';
                                                            bgCol = '#fef2f2';
                                                            textCol = '#991b1b';
                                                            extraStyle = { boxShadow: '0 0 0 2px rgba(239,68,68,0.1)' };
                                                            badgeElement = <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#ffffff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: '2px' }}>Your Selection</span>;
                                                        }
                                                    } else if (isSelected) {
                                                        borderCol = 'rgba(108,99,255,0.3)';
                                                        bgCol = '#eef2ff';
                                                        textCol = '#312e81';
                                                        badgeElement = <span style={{ marginLeft: 'auto', background: '#6c63ff', color: '#ffffff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: '2px' }}>Selected</span>;
                                                    }

                                                    return (
                                                        <div 
                                                            key={oIdx} 
                                                            style={{
                                                                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: isMobile ? '10px 12px' : '12px 16px',
                                                                borderRadius: '12px', border: `1px solid ${borderCol}`, background: bgCol,
                                                                color: textCol, fontSize: '13px', fontWeight: 600, ...extraStyle
                                                            }}
                                                        >
                                                            <span style={{ width: '24px', height: '24px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', flexShrink: 0, marginTop: '1px' }}>
                                                                {['A','B','C','D'][oIdx]}
                                                            </span>
                                                            <span style={{ flexGrow: 1, lineHeight: '1.4', wordBreak: 'break-word', marginTop: '3px' }}>{opt}</span>
                                                            {badgeElement}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Explanation */}
                                            {selectedSubDetail.quizId?.showExplanations && q.explanation && (
                                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explanation</span>
                                                    <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5' }}>{q.explanation}</p>
                                                    {q.explanationImage && (
                                                        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9', maxHeight: '200px', background: '#f8fafc', padding: '8px', display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                                            <img src={q.explanationImage} alt="Explanation Graphic" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
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
                </div>,
                document.body
            )}
        </div>
    );
};

export default MyResults;
