import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, CalendarDays, Clock, Activity, Medal, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars

const triggerFullscreen = async () => {
    const hasFS = typeof document !== 'undefined' && 
                  !!(document.documentElement.requestFullscreen || 
                     document.documentElement.webkitRequestFullscreen || 
                     document.documentElement.mozRequestFullScreen || 
                     document.documentElement.msRequestFullscreen);
    if (!hasFS) return;

    const el = document.documentElement;
    const req = el.requestFullscreen || 
                el.webkitRequestFullscreen || 
                el.mozRequestFullScreen || 
                el.msRequestFullscreen;
    if (req) {
        try {
            await req.call(el);
        } catch (err) {
            console.warn("Fullscreen request failed", err);
            const reqBody = document.body.requestFullscreen || 
                            document.body.webkitRequestFullscreen || 
                            document.body.mozRequestFullScreen || 
                            document.body.msRequestFullscreen;
            if (reqBody) {
                try { await reqBody.call(document.body); } catch { /* ignore */ }
            }
        }
    }
};

const UserDashboard = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/api/quiz`, { headers: { Authorization: `Bearer ${user.token}` } })
            .then(r => setQuizzes(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user.token]);

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        setJoining(true); setJoinError('');
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/verify-code`,
                { quizCode: joinCode },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            await triggerFullscreen();
            navigate(`/quiz/${joinCode.toUpperCase().trim()}`);
        } catch (err) {
            setJoinError(err.response?.data?.message || 'Invalid code or quiz not available.');
        } finally { setJoining(false); }
    };

    const formatTime = (t) => {
        if (!t) return null;
        const d = new Date(t), now = new Date(), diff = d - now;
        if (diff < 0) return { text: 'Started', color: 'var(--color-success)', active: true };
        if (diff < 10 * 60000) return { text: `Starts in ${Math.ceil(diff / 60000)}m`, color: 'var(--color-warning)', active: false };
        try {
            return { 
                text: d.toLocaleString(undefined, { 
                    month: 'short', day: 'numeric', year: 'numeric', 
                    hour: 'numeric', minute: '2-digit', hour12: true 
                }), 
                color: 'var(--color-text-secondary)', 
                active: false 
            };
        } catch {
            return { text: d.toString(), color: 'var(--color-text-secondary)', active: false };
        }
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }
    };

    return (
        <motion.div 
            className="page-wrap"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ padding: '16px 12px' }}
        >
            {/* Header Section */}
            <motion.div 
                variants={itemVariants} 
                className="mb-6"
            >
                <div>
                    <h1 style={{ fontSize: 'clamp(26px, 4.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4, color: '#111', lineHeight: 1.15 }}>
                        {greeting}, <br />
                        <span style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #a29bfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {user.name?.split(' ')[0]}
                        </span> 👋
                    </h1>
                    <p style={{ color: '#666', fontSize: 'clamp(13px, 1.8vw, 15px)', fontWeight: 500 }}>
                        Ready to test your knowledge today?
                    </p>
                </div>
            </motion.div>

            {/* Direct Join & Search Bar */}
            <motion.div variants={itemVariants} className="mb-6">
                <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-2 max-w-[600px] w-full items-stretch sm:items-center">
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search quizzes by title or enter private code..."
                            value={joinCode}
                            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                            style={{
                                width: '100%', padding: '12px 16px 12px 38px', fontSize: 14, fontWeight: 600,
                                color: '#111', background: 'white',
                                border: joinError ? '2px solid rgba(255,59,48,0.5)' : '1px solid rgba(0,0,0,0.08)',
                                borderRadius: 12, outline: 'none', transition: 'all 0.2s',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                            }}
                            onFocus={(e) => { if(!joinError) e.target.style.borderColor = '#6c63ff'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.06)'; }}
                            onBlur={(e) => { if(!joinError) e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)'; }}
                        />
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.6, pointerEvents: 'none' }}>
                            🔍
                        </span>
                    </div>
                    {joinCode.trim() && (
                        <button 
                            type="submit" 
                            disabled={joining} 
                            className="h-[44px] sm:h-auto justify-center"
                            style={{
                                padding: '12px 20px', borderRadius: 12, border: 'none',
                                background: joining ? '#e2e2ea' : '#6c63ff',
                                color: joining ? '#a0a0ab' : 'white',
                                fontWeight: 700, fontSize: 13, cursor: joining ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4,
                                boxShadow: joining ? 'none' : '0 4px 10px rgba(108,99,255,0.12)'
                            }}
                        >
                            {joining ? 'Verifying...' : 'Join Direct'} <ArrowRight size={14} strokeWidth={3} />
                        </button>
                    )}
                </form>
                {joinError && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#ff3b30', fontSize: 12, fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>⚠️</span> {joinError}
                    </motion.p>
                )}
            </motion.div>

            {/* Active Quizzes Grid */}
            <motion.div variants={itemVariants}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#111' }}>Live & Upcoming</h2>
                    {quizzes.length > 0 && <span style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, color: '#555' }}>{quizzes.length} available</span>}
                </div>

                {loading ? (
                    <div className="grid-auto">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 20 }} />)}
                    </div>
                ) : quizzes.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', background: 'white', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#f8f9fa', marginBottom: 16 }}>
                            <CalendarDays size={24} color="#aaa" />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#333' }}>No public quizzes running</h3>
                        <p style={{ color: '#777', fontSize: 13, maxWidth: 280, margin: '0 auto' }}>Quizzes will appear here automatically when the admin starts them.</p>
                    </div>
                ) : (() => {
                    const filteredQuizzes = quizzes.filter(quiz => 
                        quiz.title.toLowerCase().includes(joinCode.toLowerCase()) ||
                        quiz.quizCode.toLowerCase().includes(joinCode.toLowerCase())
                    );

                    if (filteredQuizzes.length === 0) {
                        return (
                            <div style={{ padding: '40px 16px', textAlign: 'center', background: 'white', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#f8f9fa', marginBottom: 16 }}>
                                    <CalendarDays size={24} color="#aaa" />
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#333' }}>No matching quizzes found</h3>
                                <p style={{ color: '#777', fontSize: 13, maxWidth: 280, margin: '0 auto' }}>No quizzes match your search. Check code or spelling.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid-auto" style={{ gap: 16 }}>
                            {filteredQuizzes.map(quiz => {
                                const ti = formatTime(quiz.startTime);
                                const isActive = quiz.status === 'LIVE' || ti?.active;

                                return (
                                    <motion.div 
                                        key={quiz._id} 
                                        whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.04)' }}
                                        style={{ 
                                            padding: 20, background: 'white', borderRadius: 20, 
                                            border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
                                            display: 'flex', flexDirection: 'column', height: '100%',
                                            transition: 'border-color 0.3s'
                                        }}
                                    >
                                        {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #30d158, #34c759)' }} />}
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <div style={{ 
                                                width: 44, height: 44, borderRadius: 12, 
                                                background: isActive ? 'rgba(48,209,88,0.1)' : '#f5f5f7', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: isActive ? '#30d158' : '#888'
                                            }}>
                                                {isActive ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <CalendarDays size={20} strokeWidth={2} />}
                                            </div>
                                            
                                            {isActive ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(48,209,88,0.1)', color: '#24a148', borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158', animation: 'timerPulse 1.5s infinite' }} />
                                                    Live
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f5f5f7', color: '#666', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                                                    Upcoming
                                                </span>
                                            )}
                                        </div>
                                        
                                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, lineHeight: 1.3, color: '#111', flex: 1 }}>{quiz.title}</h3>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', fontWeight: 500 }}>
                                                <Clock size={14} /> {quiz.duration} mins
                                            </div>
                                            {ti && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: ti.active ? '#30d158' : '#888', fontWeight: 600 }}>
                                                    <CalendarDays size={14} /> {ti.text}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={{ marginTop: 'auto' }}>
                                            {quiz.userAttempt && quiz.userAttempt.flagCount >= 3 ? (
                                                <button 
                                                    disabled
                                                    style={{ 
                                                        width: '100%', padding: '12px', borderRadius: 12, background: '#fee2e2', 
                                                        color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700, fontSize: 13,
                                                        cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                                    }}
                                                >
                                                    ❌ Flagged / Evicted
                                                </button>
                                            ) : quiz.userAttempt && ['SUBMITTED', 'EXPIRED', 'ABANDONED'].includes(quiz.userAttempt.status) ? (
                                                <button 
                                                    disabled
                                                    style={{ 
                                                        width: '100%', padding: '12px', borderRadius: 12, background: '#f0fdf4', 
                                                        color: '#15803d', border: '1px solid rgba(21,128,61,0.15)', fontWeight: 700, fontSize: 13,
                                                        cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                                    }}
                                                >
                                                    ✓ Completed
                                                </button>
                                            ) : isActive ? (
                                                <button 
                                                    onClick={async () => {
                                                        await triggerFullscreen();
                                                        navigate(`/quiz/${quiz.quizCode}`);
                                                    }}
                                                    style={{ 
                                                        width: '100%', padding: '12px', borderRadius: 12, background: '#6c63ff', 
                                                        color: 'white', border: 'none', fontWeight: 700, fontSize: 13,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        boxShadow: '0 4px 10px rgba(108,99,255,0.2)', transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#5b52e6'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#6c63ff'; }}
                                                >
                                                    {quiz.userAttempt && quiz.userAttempt.status === 'IN_PROGRESS' ? 'Resume' : 'Start'} <ArrowRight size={14} strokeWidth={2.5} />
                                                </button>
                                            ) : (
                                                <button 
                                                    disabled
                                                    style={{ 
                                                        width: '100%', padding: '12px', borderRadius: 12, background: '#f5f5f7', 
                                                        color: '#a0a0ab', border: '1px solid rgba(0,0,0,0.05)', fontWeight: 700, fontSize: 13,
                                                        cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                                    }}
                                                >
                                                    Locked (Upcoming)
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    );
                })()}
            </motion.div>
        </motion.div>
    );
};

export default UserDashboard;
