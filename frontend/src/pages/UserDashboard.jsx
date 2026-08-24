import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, KeyRound, Clock, CalendarDays, Activity, Medal, CheckCircle2 } from 'lucide-react';

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
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    return (
        <motion.div 
            className="page-wrap"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Header Section */}
            <motion.div variants={itemVariants} style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, color: '#111', lineHeight: 1.1 }}>
                        {greeting}, <br />
                        <span style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #a29bfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {user.name?.split(' ')[0]}
                        </span> 👋
                    </h1>
                    <p style={{ color: '#666', fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                        Ready to test your knowledge today?
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%', maxWidth: 'fit-content' }}>
                    <button 
                        onClick={() => navigate('/my-results')} 
                        style={{ 
                            flex: '1 1 auto', padding: '12px 20px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)',
                            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 14,
                            color: '#444', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                    >
                        <Activity size={18} strokeWidth={2.5} color="#6c63ff" />
                        My Results
                    </button>
                    <button 
                        onClick={() => navigate('/leaderboard')} 
                        style={{ 
                            flex: '1 1 auto', padding: '12px 20px', borderRadius: 16, border: 'none',
                            background: '#111', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 14,
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#222'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#111'; }}
                    >
                        <Medal size={18} strokeWidth={2.5} color="#f8b400" />
                        Leaderboard
                    </button>
                </div>
            </motion.div>

            {/* Quick Join Card */}
            <motion.div variants={itemVariants} style={{ marginBottom: 48 }}>
                <div style={{
                    position: 'relative', borderRadius: 'min(28px, 6vw)', overflow: 'hidden',
                    background: 'white', border: '1px solid rgba(0,0,0,0.04)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
                }}>
                    <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(circle, rgba(108,99,255,0.06) 0%, rgba(255,255,255,0) 70%)', pointerEvents: 'none' }} />
                    
                    <div style={{ position: 'relative', padding: 'clamp(20px, 6vw, 48px)', zIndex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(108,99,255,0.1)', color: '#6c63ff', borderRadius: 100, fontWeight: 700, fontSize: 12, marginBottom: 16 }}>
                            <KeyRound size={14} strokeWidth={3} /> Have a code?
                        </div>
                        <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10, color: '#111' }}>
                            Join a Private Quiz
                        </h2>
                        <p style={{ color: '#666', fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.5, marginBottom: 24, maxWidth: 440 }}>
                            Enter the unique 6-character code provided by your instructor to instantly access your assessment.
                        </p>
                        
                        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 12, maxWidth: 500, flexWrap: 'wrap' }}>
                            <div style={{ flex: '2 1 240px', minWidth: 0 }}>
                                <input
                                    type="text"
                                    placeholder="CODE !!"
                                    value={joinCode}
                                    onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                                    style={{
                                        width: '100%', padding: '16px 20px', fontSize: 18, fontWeight: 700,
                                        letterSpacing: '0.15em', color: '#111', background: '#f8f9fa',
                                        border: joinError ? '2px solid rgba(255,59,48,0.5)' : '2px solid transparent',
                                        borderRadius: 16, outline: 'none', transition: 'all 0.2s',
                                        textTransform: 'uppercase'
                                    }}
                                    onFocus={(e) => { if(!joinError) e.target.style.border = '2px solid rgba(108,99,255,0.3)'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 4px rgba(108,99,255,0.08)'; }}
                                    onBlur={(e) => { if(!joinError) e.target.style.border = '2px solid transparent'; e.target.style.background = '#f8f9fa'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={joining || !joinCode.trim()} 
                                style={{
                                    flex: '1 1 120px', padding: '16px 28px', borderRadius: 16, border: 'none',
                                    background: (joining || !joinCode.trim()) ? '#e2e2ea' : '#6c63ff',
                                    color: (joining || !joinCode.trim()) ? '#a0a0ab' : 'white',
                                    fontWeight: 700, fontSize: 16, cursor: (joining || !joinCode.trim()) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    boxShadow: (joining || !joinCode.trim()) ? 'none' : '0 8px 16px rgba(108,99,255,0.15)'
                                }}
                            >
                                {joining ? 'Verifying...' : 'Join Quiz'} <ArrowRight size={18} strokeWidth={3} />
                            </button>
                        </form>
                        {joinError && (
                            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#ff3b30', fontSize: 14, fontWeight: 500, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 16 }}>⚠</span> {joinError}
                            </motion.p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Active Quizzes Grid */}
            <motion.div variants={itemVariants}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#111' }}>Live & Upcoming</h2>
                    {quizzes.length > 0 && <span style={{ background: 'rgba(0,0,0,0.05)', padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, color: '#555' }}>{quizzes.length} available</span>}
                </div>

                {loading ? (
                    <div className="grid-auto">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 24 }} />)}
                    </div>
                ) : quizzes.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center', background: 'white', borderRadius: 28, border: '1px dashed rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: '#f8f9fa', marginBottom: 20 }}>
                            <CalendarDays size={28} color="#aaa" />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#333' }}>No public quizzes running</h3>
                        <p style={{ color: '#777', fontSize: 15, maxWidth: 300, margin: '0 auto' }}>Quizzes will appear here automatically when the admin starts them.</p>
                    </div>
                ) : (
                    <div className="grid-auto" style={{ gap: 20 }}>
                        {quizzes.map(quiz => {
                            const ti = formatTime(quiz.startTime);
                            const isActive = ti?.active;

                            return (
                                <motion.div 
                                    key={quiz._id} 
                                    whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}
                                    style={{ 
                                        padding: 24, background: 'white', borderRadius: 24, 
                                        border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
                                        display: 'flex', flexDirection: 'column', height: '100%',
                                        transition: 'border-color 0.3s'
                                    }}
                                >
                                    {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #30d158, #34c759)' }} />}
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                        <div style={{ 
                                            width: 48, height: 48, borderRadius: 16, 
                                            background: isActive ? 'rgba(48,209,88,0.1)' : '#f5f5f7', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: isActive ? '#30d158' : '#888'
                                        }}>
                                            {isActive ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <CalendarDays size={24} strokeWidth={2} />}
                                        </div>
                                        
                                        {isActive ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(48,209,88,0.1)', color: '#24a148', borderRadius: 100, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158', animation: 'timerPulse 1.5s infinite' }} />
                                                Live Now
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f5f5f7', color: '#666', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                                                Upcoming
                                            </span>
                                        )}
                                    </div>
                                    
                                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, lineHeight: 1.3, color: '#111', flex: 1 }}>{quiz.title}</h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#666', fontWeight: 500 }}>
                                            <Clock size={16} /> {quiz.duration} mins time limit
                                        </div>
                                        {ti && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: ti.active ? '#30d158' : '#888', fontWeight: 600 }}>
                                                <CalendarDays size={16} /> {ti.text}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ 
                                        padding: '12px', borderRadius: 14, background: '#f8f9fa', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        fontSize: 14, color: '#555', fontWeight: 600, border: '1px dashed rgba(0,0,0,0.1)'
                                    }}>
                                        <KeyRound size={16} opacity={0.6}/> Enter code above to join
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default UserDashboard;
