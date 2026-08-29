import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, CalendarDays, Clock, CheckCircle2, Search } from 'lucide-react';
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
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }
    };

    return (
        <motion.div 
            className="w-full flex flex-col gap-5 sm:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Header Section */}
            <motion.div 
                variants={itemVariants} 
                className="w-full flex flex-col gap-1 items-start justify-start border-b border-gray-100 pb-4"
            >
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 leading-none">
                    {greeting}, <br />
                    <span className="bg-gradient-to-r from-[#6c63ff] to-[#a29bfe] bg-clip-text text-transparent">
                        {user.name?.split(' ')[0]}
                    </span> 👋
                </h1>
                <p className="text-sm sm:text-base text-gray-500 font-medium mt-1">
                    Ready to test your knowledge today?
                </p>
            </motion.div>

            {/* Direct Join & Search Bar */}
            <motion.div variants={itemVariants} className="w-full">
                <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 max-w-[620px] w-full items-stretch">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search quizzes or enter code..."
                            value={joinCode}
                            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                            className="w-full h-[48px] sm:h-[52px] pr-4 text-sm sm:text-base font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/5 shadow-sm transition-all"
                            style={{ paddingLeft: '44px' }}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Search size={18} />
                        </span>
                    </div>
                    {joinCode.trim() && (
                        <button 
                            type="submit" 
                            disabled={joining} 
                            className="h-[48px] sm:h-[52px] px-6 rounded-xl bg-[#6c63ff] text-white font-bold text-sm cursor-pointer shadow-md hover:bg-[#5b52e6] hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {joining ? 'Verifying...' : 'Join Direct'} <ArrowRight size={16} strokeWidth={2.5} />
                        </button>
                    )}
                </form>
                {joinError && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1">
                        <span>⚠️</span> {joinError}
                    </motion.p>
                )}
            </motion.div>

            {/* Active Quizzes Grid */}
            <motion.div variants={itemVariants} className="w-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Live & Upcoming Quizzes</h2>
                    {quizzes.length > 0 && <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600">{quizzes.length} Available</span>}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton h-44 rounded-2xl" />)}
                    </div>
                ) : quizzes.length === 0 ? (
                    <div className="py-12 px-4 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 mb-4">
                            <CalendarDays size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 mb-1">No public quizzes running</h3>
                        <p className="text-xs sm:text-sm text-gray-500 max-w-[280px] mx-auto">Quizzes will appear here automatically when the admin starts them.</p>
                    </div>
                ) : (() => {
                    const filteredQuizzes = quizzes.filter(quiz => 
                        quiz.title.toLowerCase().includes(joinCode.toLowerCase()) ||
                        quiz.quizCode.toLowerCase().includes(joinCode.toLowerCase())
                    );

                    if (filteredQuizzes.length === 0) {
                        return (
                            <div className="py-12 px-4 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 mb-4">
                                    <CalendarDays size={24} className="text-gray-400" />
                                </div>
                                <h3 className="text-base font-bold text-gray-800 mb-1">No matching quizzes found</h3>
                                <p className="text-xs sm:text-sm text-gray-500 max-w-[280px] mx-auto">No quizzes match your search. Check code or spelling.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                            {filteredQuizzes.map(quiz => {
                                const ti = formatTime(quiz.startTime);
                                const isActive = quiz.status === 'LIVE' || ti?.active;

                                return (
                                    <motion.div 
                                        key={quiz._id} 
                                        whileHover={{ y: -3, boxShadow: '0 12px 20px rgba(0,0,0,0.04)' }}
                                        className="bg-white rounded-2xl border border-gray-100 relative overflow-hidden flex flex-col justify-between transition-all shadow-sm"
                                        style={{ padding: 'var(--card-padding)', gap: 'var(--card-gap)' }}
                                    >
                                        {isActive && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6c63ff] to-[#a29bfe]" />}
                                        
                                        <div className="flex flex-col" style={{ gap: '16px' }}>
                                            <div className="flex justify-between items-center">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>
                                                    {isActive ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <CalendarDays size={18} strokeWidth={2} />}
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-600 uppercase tracking-wider">
                                                        #{quiz.quizCode}
                                                    </span>
                                                    {isActive ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-xs font-extrabold uppercase tracking-wider">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            Live
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-bold uppercase tracking-wider">
                                                            Upcoming
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2">{quiz.title}</h3>
                                            
                                            <div className="flex flex-col" style={{ gap: '8px' }}>
                                                <div className="flex items-center gap-2.5 text-sm text-gray-500 font-semibold">
                                                    <Clock size={15} className="text-gray-400" /> Time Limit: {quiz.duration} Minutes
                                                </div>
                                                {ti && (
                                                    <div className={`flex items-center gap-2.5 text-sm font-semibold ${ti.active ? 'text-green-600' : 'text-gray-400'}`}>
                                                        <CalendarDays size={15} /> {ti.text}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="w-full">
                                            {quiz.userAttempt && quiz.userAttempt.flagCount >= 3 ? (
                                                <button 
                                                    disabled
                                                    className="w-full h-11 rounded-xl bg-red-50 text-red-500 border border-red-100 font-bold text-sm tracking-wider uppercase cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    ❌ Flagged / Evicted
                                                </button>
                                            ) : quiz.userAttempt && ['SUBMITTED', 'EXPIRED', 'ABANDONED'].includes(quiz.userAttempt.status) ? (
                                                quiz.resultsPublished ? (
                                                    <button 
                                                        onClick={() => navigate('/my-results')}
                                                        className="w-full h-11 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm tracking-wider uppercase cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                                                    >
                                                        📊 View Result
                                                    </button>
                                                ) : (
                                                    <button 
                                                        disabled
                                                        className="w-full h-11 rounded-xl bg-green-50 text-green-700 border border-green-100 font-bold text-sm tracking-wider uppercase cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        ✓ Completed
                                                    </button>
                                                )
                                            ) : isActive ? (
                                                <button 
                                                    onClick={async () => {
                                                        await triggerFullscreen();
                                                        navigate(`/quiz/${quiz.quizCode}`);
                                                    }}
                                                    className="w-full h-11 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e6] text-white font-bold text-sm tracking-wider uppercase cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                                                >
                                                    {quiz.userAttempt && quiz.userAttempt.status === 'IN_PROGRESS' ? 'Resume Quiz' : 'Start Quiz'} <ArrowRight size={16} strokeWidth={2.5} />
                                                </button>
                                            ) : (
                                                <button 
                                                    disabled
                                                    className="w-full h-11 rounded-xl bg-gray-50 text-gray-400 border border-gray-100 font-bold text-sm tracking-wider uppercase cursor-not-allowed flex items-center justify-center gap-2"
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
