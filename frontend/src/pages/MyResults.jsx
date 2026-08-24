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
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }} onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}>
                    <div style={{
                        background: 'white', padding: 28, borderRadius: 24, maxWidth: 640, width: '100%',
                        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 16 }}>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: 20, color: '#111', margin: 0 }}>{selectedSubDetail.quizId?.title}</h3>
                                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                                    Score: <strong>{selectedSubDetail.score}</strong> · Submitted: {new Date(selectedSubDetail.submittedAt).toLocaleString()}
                                </p>
                            </div>
                            <button className="btn btn-ghost" onClick={() => { setSelectedSubDetail(null); setExpandedQuestions([]); }}>✕ Close</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {!selectedSubDetail.quizId?.showCorrectAnswers && !selectedSubDetail.quizId?.showExplanations ? (
                                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: 16 }}>
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: 0, fontWeight: 500 }}>
                                        🔒 Correct answers and explanations are disabled for this quiz.
                                    </p>
                                </div>
                            ) : (
                                expandedQuestions.map((q, idx) => {
                                    const studentAns = selectedSubDetail.answers?.find(a => a.questionId === q._id);
                                    return (
                                        <div key={q._id} style={{ padding: 18, borderRadius: 16, background: '#f8f9fa', border: '1px solid rgba(0,0,0,0.04)' }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 12 }}>
                                                Q{idx + 1}. {q.question}
                                            </div>
                                            {q.image && (
                                                <img src={q.image} alt="Question" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 10, marginBottom: 12, display: 'block' }} />
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
                                                {q.options.map((opt, oIdx) => {
                                                    const isSelected = studentAns?.selectedOption === opt;
                                                    const isCorrectOpt = q.correctAnswer === opt;
                                                    
                                                    let optColor = '#4a5568';
                                                    let optWeight = 400;
                                                    let optBg = 'transparent';

                                                    if (selectedSubDetail.quizId?.showCorrectAnswers) {
                                                        if (isCorrectOpt) {
                                                            optColor = '#1a7a3a';
                                                            optWeight = 700;
                                                            optBg = 'rgba(48,209,88,0.08)';
                                                        } else if (isSelected) {
                                                            optColor = '#cc000a';
                                                            optWeight = 700;
                                                            optBg = 'rgba(255,59,48,0.08)';
                                                        }
                                                    } else if (isSelected) {
                                                        optColor = 'var(--brand-accent)';
                                                        optWeight = 700;
                                                        optBg = 'rgba(108,99,255,0.08)';
                                                    }

                                                    return (
                                                        <div key={oIdx} style={{ padding: '8px 12px', borderRadius: 8, background: optBg, color: optColor, fontWeight: optWeight, display: 'flex', gap: 8 }}>
                                                            <strong>{['A','B','C','D'][oIdx]}.</strong> {opt}
                                                            {selectedSubDetail.quizId?.showCorrectAnswers && isCorrectOpt && ' ✓ (Correct)'}
                                                            {isSelected && ' 👤 (Your Selection)'}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {selectedSubDetail.quizId?.showExplanations && q.explanation && (
                                                <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 12, marginTop: 8 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase', marginBottom: 4 }}>Explanation</div>
                                                    <div style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>{q.explanation}</div>
                                                    {q.explanationImage && (
                                                        <img src={q.explanationImage} alt="Explanation" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 10, marginTop: 8 }} />
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
