import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertCircle, User, Terminal, Bell, ShieldAlert, 
    Video, Layout, RefreshCcw, ExternalLink, PlayCircle,
    Users, CheckCircle2
} from 'lucide-react';
import ImportQuestionsModal from '../components/admin/ImportQuestionsModal';
import { GuideProvider, useGuide } from '../components/admin/GuideEngine';

// ── Neumorphic styles ──
const neu = {
    card: {
        background: 'var(--neu-bg)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '8px 8px 20px var(--neu-dark), -8px -8px 20px var(--neu-light)'
    },
    inset: {
        background: 'var(--neu-bg)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'inset 4px 4px 10px var(--neu-dark), inset -4px -4px 10px var(--neu-light)'
    }
};

const NeuInput = ({ label, ...props }) => (
    <div>
        {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7a8090', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>}
        <input
            {...props}
            className="neu-input"
            style={{ ...(props.style || {}) }}
        />
    </div>
);

const NeuButton = ({ children, onClick, type = 'button', variant = 'default', small, disabled, style: sx, ...props }) => {
    const [pressed, setPressed] = useState(false);
    const gradients = {
        primary: 'linear-gradient(135deg,#6c63ff,#a29bfe)',
        success: 'linear-gradient(135deg,#30d158,#00b894)',
        danger:  'linear-gradient(135deg,#ff3b30,#ff6b6b)',
        warning: 'linear-gradient(135deg,#ff9f0a,#ffd32a)',
    };
    const textColors = { primary: 'white', success: 'white', danger: 'white', warning: '#3d2c00', default: '#555' };
    const isDefault = variant === 'default';
    return (
        <button type={type} onClick={onClick} disabled={disabled} {...props}
            onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
            style={{
                padding: small ? '8px 14px' : '10px 20px',
                borderRadius: 'var(--r-md)', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: small ? 12 : 13, fontFamily: 'inherit',
                background: isDefault ? 'var(--neu-bg)' : gradients[variant],
                color: textColors[variant] || '#555',
                opacity: disabled ? 0.5 : 1,
                boxShadow: isDefault
                    ? (pressed ? 'inset 3px 3px 8px var(--neu-dark), inset -3px -3px 8px var(--neu-light)' : '5px 5px 12px var(--neu-dark), -5px -5px 12px var(--neu-light)')
                    : '0 4px 14px rgba(108,99,255,0.25)',
                transition: 'all 140ms ease', transform: pressed ? 'scale(0.97)' : 'scale(1)',
                whiteSpace: 'nowrap', ...sx
            }}
        >{children}</button>
    );
};

// Converts a Date to the format required by datetime-local inputs (local time, not UTC)
const toLocalInputValue = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 16);
};

const TABS = [
    { id: 'create-quiz', label: '＋ Create Quiz' },
    { id: 'quizzes', label: '📋 Quiz List' },
    { id: 'questions', label: '❓ Questions' },
    { id: 'results', label: '📊 Results' },
    { id: 'users', label: '👥 Users' },
];

const AdminDashboard = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('create-quiz');
    const [quizzes, setQuizzes] = useState([]);
    const [results, setResults] = useState([]);
    const [users, setUsers] = useState([]);
    const [attendees, setAttendees] = useState(null);

    const [usersPage, setUsersPage] = useState(1);
    const [usersPages, setUsersPages] = useState(1);
    const [usersTotal, setUsersTotal] = useState(0);

    const [userSubTab, setUserSubTab] = useState('approved');
    const [pendingUsers, setPendingUsers] = useState([]);
    const [pendingPage, setPendingPage] = useState(1);
    const [pendingPages, setPendingPages] = useState(1);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [filterYear, setFilterYear] = useState('');
    const [filterDept, setFilterDept] = useState('');

    const [resultsPage, setResultsPage] = useState(1);
    const [resultsPages, setResultsPages] = useState(1);
    const [resultsTotal, setResultsTotal] = useState(0);

    const [attendeesPage, setAttendeesPage] = useState(1);
    const [attendeesPages, setAttendeesPages] = useState(1);
    const [attendeesTotal, setAttendeesTotal] = useState(0);
    const [selectedQuizForAttendees, setSelectedQuizForAttendees] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAttendee, setSelectedAttendee] = useState(null);
    const [registrationOpen, setRegistrationOpen] = useState(true);
    const [flagAlerts, setFlagAlerts] = useState([]);
    const [socketConnected, setSocketConnected] = useState(false);
    const socketRef = useRef(null);

    const [title, setTitle] = useState('');
    const [quizCode, setQuizCode] = useState('');
    const [duration, setDuration] = useState(30);
    const [startTime, setStartTime] = useState(toLocalInputValue(new Date()));
    const [liveMonitoringEnabled, setLiveMonitoringEnabled] = useState(false);

    const [editingQuizId, setEditingQuizId] = useState(null);
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [status, setStatus] = useState('DRAFT');

    const [randomizeQuestions, setRandomizeQuestions] = useState(false);
    const [randomizeOptions, setRandomizeOptions] = useState(false);
    const [numberOfQuestions, setNumberOfQuestions] = useState(0);
    const [allowQuestionNavigation, setAllowQuestionNavigation] = useState(true);
    const [allowAnswerChange, setAllowAnswerChange] = useState(true);

    const [marksPerQuestion, setMarksPerQuestion] = useState(1);
    const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(false);
    const [negativeMarks, setNegativeMarks] = useState(0);

    const [oneAttemptOnly, setOneAttemptOnly] = useState(true);
    const [singleActiveSession, setSingleActiveSession] = useState(true);
    const [fullscreenRequired, setFullscreenRequired] = useState(false);
    const [tabSwitchMonitoring, setTabSwitchMonitoring] = useState(false);

    const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(true);
    const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
    const [showExplanations, setShowExplanations] = useState(false);
    const [allowQuestionImages, setAllowQuestionImages] = useState(true);

    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [questionsList, setQuestionsList] = useState([]);
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [questionImage, setQuestionImage] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [explanation, setExplanation] = useState('');
    const [explanationImage, setExplanationImage] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importedQuestions, setImportedQuestions] = useState([]);
    const { startGuide } = useGuide();

    const [openDropdownId, setOpenDropdownId] = useState(null);
    const dropdownRef = useRef(null);
    const fileInputRef = useRef(null);
    const formPanelRef = useRef(null);
    const questionListRef = useRef(null);

    const renderPagination = (page, pages, setPage) => {
        if (pages <= 1) return null;
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 }}>
                <NeuButton small disabled={page <= 1} onClick={() => setPage(page - 1)}>◀ Prev</NeuButton>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Page {page} of {pages}
                </span>
                <NeuButton small disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ▶</NeuButton>
            </div>
        );
    };

    const getStats = () => {
        if (!attendees || !attendees.attendees) return { total: 0, connected: 0, reconnecting: 0, offline: 0, submitted: 0, expired: 0, suspicious: 0 };
        let total = attendees.attendees.length;
        let connected = 0;
        let reconnecting = 0;
        let offline = 0;
        let submitted = 0;
        let expired = 0;
        let suspicious = 0;

        attendees.attendees.forEach(a => {
            if (a.status === 'submitted') {
                submitted++;
            } else if (a.status === 'expired') {
                expired++;
            }
            
            if (a.status !== 'submitted') {
                if (a.connectionStatus === 'CONNECTED') connected++;
                else if (a.connectionStatus === 'RECONNECTING') reconnecting++;
                else offline++;
            }

            if (a.isSuspicious || a.flagCount >= 3) {
                suspicious++;
            }
        });

        return { total, connected, reconnecting, offline, submitted, expired, suspicious };
    };

    const stats = getStats();

    const filteredAttendees = attendees?.attendees?.filter(a => {
        const nameMatch = a.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const emailMatch = a.email?.toLowerCase().includes(searchQuery.toLowerCase());
        if (searchQuery && !nameMatch && !emailMatch) return false;

        if (filter === 'active') {
            return a.status === 'in_progress' && (a.connectionStatus === 'CONNECTED' || a.connectionStatus === 'RECONNECTING');
        }
        if (filter === 'offline') {
            return a.status === 'in_progress' && a.connectionStatus === 'DISCONNECTED';
        }
        if (filter === 'submitted') {
            return a.status === 'submitted';
        }
        if (filter === 'suspicious') {
            return a.isSuspicious || a.flagCount >= 3;
        }
        return true;
    }) || [];

    useEffect(() => {
        fetchQuizzes();
        fetchAppSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'results') fetchResults(resultsPage);
    }, [activeTab, resultsPage]);

    useEffect(() => {
        if (activeTab === 'users') {
            if (userSubTab === 'approved') {
                fetchUsers(usersPage);
            } else {
                fetchPendingUsers(pendingPage);
            }
        }
    }, [activeTab, userSubTab, usersPage, pendingPage, filterYear, filterDept]);

    useEffect(() => {
        // Explicitly release any body scroll lock when switching tabs to ensure quizzes/results are scrollable
        document.body.style.overflow = '';
    }, [activeTab]);

    useEffect(() => {
        if (selectedQuizId) {
            fetchQuestions(selectedQuizId);
            handleCancelEdit(); // Reset form when switching quizzes
        } else {
            setQuestionsList([]);
        }
    }, [selectedQuizId]);
 
    useEffect(() => {
        if (!selectedQuizForAttendees) {
            console.log('🔌 No quiz selected for monitoring. Socket idle.');
            setSocketConnected(false);
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }
        
        const apiUrl = import.meta.env.VITE_API_URL;
        console.log('📡 Admin Monitoring Link: Initializing...', { quizId: selectedQuizForAttendees, url: apiUrl });
        
        const socket = io(apiUrl, {
            auth: {
                token: user.token
            },
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;
        
        socket.on('connect', () => {
            const rid = selectedQuizForAttendees.toString();
            console.log('✅ MONITOR CONNECTED:', socket.id);
            console.log('📢 Joining Monitoring Room:', `admin:${rid}`);
            socket.emit('admin:join', rid);
            setSocketConnected(true);
        });

        socket.on('admin:confirmed', (data) => {
            console.log('🛰️ ROOM LINK VERIFIED:', data.room);
        });
        
        socket.on('disconnect', (reason) => {
            console.warn('❌ MONITOR DISCONNECTED:', reason);
            setSocketConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('⚠️ MONITOR LINK ERROR:', err.message);
            setSocketConnected(false);
        });
        
        socket.on('monitor:participant', (data) => {
            console.log('📡 LIVE PARTICIPANT UPDATE RECEIVED:', data);
            setAttendees(prev => {
                if (!prev) return prev;
                const uid = data.userId?.toString();
                let found = false;
                const updatedAttendees = prev.attendees.map(a => {
                    const aid = a._id?.toString();
                    if (aid === uid) {
                        found = true;
                        return {
                            ...a,
                            ...(data.status ? { status: data.status.toLowerCase() } : {}),
                            ...(data.connectionStatus ? { connectionStatus: data.connectionStatus } : {}),
                            ...(data.currentQuestionIndex !== undefined ? { currentQuestionIndex: data.currentQuestionIndex } : {}),
                            ...(data.answeredCount !== undefined ? { answeredCount: data.answeredCount } : {}),
                            ...(data.remainingSeconds !== undefined ? { remainingSeconds: data.remainingSeconds } : {}),
                            ...(data.lastSeenAt ? { lastSeenAt: data.lastSeenAt } : {}),
                            ...(data.attemptId ? { attemptId: data.attemptId } : {}),
                            _lastUpdate: Date.now()
                        };
                    }
                    return a;
                });

                if (!found && data.userName) {
                    updatedAttendees.push({
                        _id: data.userId,
                        name: data.userName,
                        email: data.userEmail,
                        status: data.status?.toLowerCase() || 'in_progress',
                        connectionStatus: data.connectionStatus || 'CONNECTED',
                        currentQuestionIndex: data.currentQuestionIndex || 0,
                        answeredCount: data.answeredCount || 0,
                        remainingSeconds: data.remainingSeconds || 0,
                        startedAt: data.startedAt || new Date(),
                        lastSeenAt: data.lastSeenAt || new Date(),
                        flagCount: data.flagCount || 0,
                        flagEvents: data.flagEvents || [],
                        attemptId: data.attemptId
                    });
                }

                return { ...prev, attendees: updatedAttendees };
            });
        });

        socket.on('monitor:flag', (data) => {
            console.log('🚩 LIVE SECURITY ALERT RECEIVED:', data);
            
            setFlagAlerts(prev => {
                const isDup = prev.some(a => a.id === data.id || (a.userName === data.userName && a.timestamp === data.timestamp));
                if (isDup) return prev;
                const alertData = { 
                    ...data, 
                    id: data.id || `alert-${Date.now()}`, 
                    receivedAt: new Date() 
                };
                return [alertData, ...prev].slice(0, 50);
            });
            
            setAttendees(prev => {
                if (!prev) return prev;
                const uid = data.userId?.toString();
                console.log('🔄 Table Update Sync for UserID:', uid);
                
                const updatedAttendees = prev.attendees.map(a => {
                    const aid = a._id?.toString();
                    if (aid === uid) {
                        console.log(`✨ Matched attendee ${a.name}! Updating flags to ${data.flagCount}`);
                        return { 
                            ...a, 
                            flagCount: data.flagCount, 
                            isSuspicious: true, 
                            lastFlagType: data.flagType,
                            _lastUpdate: Date.now()
                        };
                    }
                    return a;
                });
                return { ...prev, attendees: updatedAttendees };
            });
        });

        return () => {
            if (socketRef.current) {
                console.log('🧹 Cleaning up monitoring link...');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [selectedQuizForAttendees, user.token]);

    useEffect(() => {
        const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdownId(null); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const fetchQuizzes = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/all-quizzes`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res) { setQuizzes(res.data); if (res.data.length > 0 && !selectedQuizId) setSelectedQuizId(res.data[0]._id); }
    };
    const fetchResults = async (page = 1) => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/results?page=${page}&limit=10`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res && res.data) {
            setResults(res.data.submissions || []);
            setResultsPage(res.data.page || 1);
            setResultsPages(res.data.pages || 1);
            setResultsTotal(res.data.total || 0);
        }
    };
    const fetchUsers = async (page = 1) => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users?page=${page}&limit=10&isApproved=true`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res && res.data) {
            setUsers(res.data.users || []);
            setUsersPage(res.data.page || 1);
            setUsersPages(res.data.pages || 1);
            setUsersTotal(res.data.total || 0);
        }
    };
    const fetchPendingUsers = async (page = 1) => {
        const query = `page=${page}&limit=10&isApproved=false&year=${filterYear}&department=${filterDept}`;
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users?${query}`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res && res.data) {
            setPendingUsers(res.data.users || []);
            setPendingPage(res.data.page || 1);
            setPendingPages(res.data.pages || 1);
            setPendingTotal(res.data.total || 0);
        }
    };
    const handleApproveUser = async (userId) => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/approve-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } });
            alert('Student approved successfully.');
            fetchPendingUsers(pendingPage);
            fetchUsers(usersPage);
        } catch (e) {
            alert(e.response?.data?.message || 'Error approving student');
        }
    };
    const handleRejectUser = async (userId) => {
        if (!window.confirm('Are you sure you want to reject and delete this student registration request?')) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/reject-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } });
            alert('Student request rejected and removed.');
            fetchPendingUsers(pendingPage);
        } catch (e) {
            alert(e.response?.data?.message || 'Error rejecting student');
        }
    };
    const fetchAppSettings = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/settings`).catch(console.error);
        if (res) setRegistrationOpen(res.data.registrationOpen);
    };
    const handleToggleRegistration = async () => {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-registration`, {}, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message || 'Error'));
        if (res) setRegistrationOpen(res.data.registrationOpen);
    };

    const fetchLiveAttendees = async (quizId, page = 1) => {
        try {
            console.log('🔄 Fetching attendee snapshot for:', quizId, 'page:', page);
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/live-attendees/${quizId}?page=${page}&limit=10`, { headers: { Authorization: `Bearer ${user.token}` } });
            setAttendees(res.data); 
            setAttendeesPage(res.data.page || 1);
            setAttendeesPages(res.data.pages || 1);
            setAttendeesTotal(res.data.attendeeCount || 0);
            
            // Only reset alerts if we switch to a DIFFERENT quiz
            if (selectedQuizForAttendees !== quizId) {
                setFlagAlerts([]);
                setSelectedQuizForAttendees(quizId);
            }
        } catch (e) { 
            console.error('❌ Failed to fetch attendees:', e); 
        }
    };

    const handleToggleMonitoring = async (quizId) => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-monitoring`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } });
            fetchQuizzes();
        } catch (e) {
            alert(e.response?.data?.message || 'Error toggling live monitoring');
        }
    };

    const handleForceSubmit = async (attemptId) => {
        if (!window.confirm('Are you sure you want to force submit this candidate\'s attempt?')) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/attempt/${attemptId}/force-submit`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            alert('Attempt force-submitted successfully.');
            if (selectedQuizForAttendees) fetchLiveAttendees(selectedQuizForAttendees);
        } catch (e) {
            alert(e.response?.data?.message || 'Error forcing submission');
        }
    };

    const handleInvalidateSession = async (attemptId) => {
        if (!window.confirm('Are you sure you want to invalidate this candidate\'s session? This will force kick them from the exam.')) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/attempt/${attemptId}/invalidate`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            alert('Candidate session invalidated.');
            if (selectedQuizForAttendees) fetchLiveAttendees(selectedQuizForAttendees);
        } catch (e) {
            alert(e.response?.data?.message || 'Error invalidating session');
        }
    };

    const handleToggleResults = async (quizId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-results`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleToggleLeaderboard = async (quizId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/toggle-leaderboard`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleStopQuiz = async (quizId) => {
        if (!window.confirm('Stop this quiz? Users won\'t be able to take it anymore.')) return;
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/stop-quiz`, { quizId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleDeleteQuiz = async (quizId) => {
        if (!window.confirm('DELETE this quiz? All questions and submissions will be removed. This cannot be undone!')) return;
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/delete-quiz/${quizId}`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        setOpenDropdownId(null); fetchQuizzes();
    };
    const handleBlockUser = async (userId) => {
        if (!window.confirm('Block this user?')) return;
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/block-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        fetchUsers();
    };
    const handleUnblockUser = async (userId) => {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/unblock-user`, { userId }, { headers: { Authorization: `Bearer ${user.token}` } }).catch(e => alert(e.response?.data?.message));
        fetchUsers();
    };
    const handleEditQuizClick = (q) => {
        setEditingQuizId(q._id);
        setTitle(q.title);
        setQuizCode(q.quizCode);
        setDuration(q.duration);
        setStartTime(toLocalInputValue(new Date(q.startTime)));
        setLiveMonitoringEnabled(q.liveMonitoringEnabled || false);
        setDescription(q.description || '');
        setInstructions(q.instructions || '');
        setTimezone(q.timezone || 'UTC');
        setStatus(q.status || 'DRAFT');
        setRandomizeQuestions(q.randomizeQuestions || false);
        setRandomizeOptions(q.randomizeOptions || false);
        setNumberOfQuestions(q.numberOfQuestions || 0);
        setAllowQuestionNavigation(q.allowQuestionNavigation !== undefined ? q.allowQuestionNavigation : true);
        setAllowAnswerChange(q.allowAnswerChange !== undefined ? q.allowAnswerChange : true);
        setMarksPerQuestion(q.marksPerQuestion !== undefined ? q.marksPerQuestion : 1);
        setNegativeMarkingEnabled(q.negativeMarkingEnabled || false);
        setNegativeMarks(q.negativeMarks || 0);
        setOneAttemptOnly(q.oneAttemptOnly !== undefined ? q.oneAttemptOnly : true);
        setSingleActiveSession(q.singleActiveSession !== undefined ? q.singleActiveSession : true);
        setFullscreenRequired(q.fullscreenRequired || false);
        setTabSwitchMonitoring(q.tabSwitchMonitoring || false);
        setShowScoreAfterSubmit(q.showScoreAfterSubmit !== undefined ? q.showScoreAfterSubmit : true);
        setShowCorrectAnswers(q.showCorrectAnswers || false);
        setShowExplanations(q.showExplanations || false);
        setAllowQuestionImages(q.allowQuestionImages !== undefined ? q.allowQuestionImages : true);

        if (formPanelRef.current) formPanelRef.current.scrollIntoView({ behavior: 'smooth' });
        setActiveTab('create-quiz');
    };

    const handleCancelEditQuiz = () => {
        setEditingQuizId(null);
        setTitle('');
        setQuizCode('');
        setDuration(30);
        setStartTime(toLocalInputValue(new Date()));
        setLiveMonitoringEnabled(false);
        setDescription('');
        setInstructions('');
        setTimezone('UTC');
        setStatus('DRAFT');
        setRandomizeQuestions(false);
        setRandomizeOptions(false);
        setNumberOfQuestions(0);
        setAllowQuestionNavigation(true);
        setAllowAnswerChange(true);
        setMarksPerQuestion(1);
        setNegativeMarkingEnabled(false);
        setNegativeMarks(0);
        setOneAttemptOnly(true);
        setSingleActiveSession(true);
        setFullscreenRequired(false);
        setTabSwitchMonitoring(false);
        setShowScoreAfterSubmit(true);
        setShowCorrectAnswers(false);
        setShowExplanations(false);
        setAllowQuestionImages(true);
        setImportedQuestions([]);
        setActiveTab('quizzes');
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        const startTimeUTC = new Date(startTime).toISOString();
        const payload = {
            title, quizCode, duration, startTime: startTimeUTC, liveMonitoringEnabled,
            description, instructions, timezone, status,
            randomizeQuestions, randomizeOptions, numberOfQuestions,
            allowQuestionNavigation, allowAnswerChange,
            marksPerQuestion, negativeMarkingEnabled, negativeMarks,
            oneAttemptOnly, singleActiveSession, fullscreenRequired, tabSwitchMonitoring,
            showScoreAfterSubmit, showCorrectAnswers, showExplanations, allowQuestionImages
        };

        try {
            if (editingQuizId) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/quiz/${editingQuizId}`, payload, { headers: { Authorization: `Bearer ${user.token}` } });
                alert('Quiz updated successfully!');
            } else {
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/create-quiz`, payload, { headers: { Authorization: `Bearer ${user.token}` } });
                const createdQuiz = res.data;
                const newQuizId = createdQuiz?._id;
                
                if (newQuizId && importedQuestions.length > 0) {
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/import-questions`, {
                        quizId: newQuizId,
                        questions: importedQuestions,
                        replace: false
                    }, { headers: { Authorization: `Bearer ${user.token}` } });
                    alert('Quiz created and all questions imported successfully!');
                } else {
                    alert('Quiz created successfully!');
                }
            }
            setImportedQuestions([]);
            handleCancelEditQuiz();
            fetchQuizzes();
        } catch (err) {
            alert(err.response?.data?.message || 'Error processing quiz');
        }
    };
    const fetchQuestions = async (quizId) => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/questions/${quizId}`, { headers: { Authorization: `Bearer ${user.token}` } }).catch(console.error);
        if (res) setQuestionsList(res.data);
    };

    const handleCancelEdit = () => {
        setEditingQuestionId(null);
        setQuestion('');
        setOptions(['', '', '', '']);
        setCorrectAnswer('');
        setQuestionImage('');
        setImagePreview('');
        setExplanation('');
        setExplanationImage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImportSuccess = (questionsPayload) => {
        if (questionsPayload) {
            setImportedQuestions(questionsPayload);
        } else {
            if (selectedQuizId) {
                fetchQuestions(selectedQuizId);
            }
        }
    };

    const handleEditQuestionClick = (q) => {
        setEditingQuestionId(q._id);
        setQuestion(q.question);
        setOptions(q.options || ['', '', '', '']);
        setCorrectAnswer(q.correctAnswer);
        setQuestionImage(q.image || '');
        setImagePreview(q.image || '');
        setExplanation(q.explanation || '');
        setExplanationImage(q.explanationImage || '');
        // Only scroll the right-side form panel to the top — never touch window scroll
        if (formPanelRef.current) {
            formPanelRef.current.scrollTop = 0;
        }
    };

    const handleDeleteQuestion = async (qId) => {
        if (!window.confirm('Are you sure you want to delete this question?')) return;
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/question/${qId}`, { headers: { Authorization: `Bearer ${user.token}` } })
            .catch(e => alert(e.response?.data?.message || 'Error deleting question'));
        fetchQuestions(selectedQuizId);
    };

    const handleAddOrEditQuestion = async (e) => {
        e.preventDefault();
        if (!options.includes(correctAnswer)) return alert('Please highlight a correct answer by clicking an option letter.');
        
        try {
            if (editingQuestionId) {
                // Edit
                await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/question/${editingQuestionId}`, 
                    { question, options, correctAnswer, image: questionImage, explanation, explanationImage }, 
                    { headers: { Authorization: `Bearer ${user.token}` } });
            } else {
                // Add
                await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/add-question`, 
                    { quizId: selectedQuizId, question, options, correctAnswer, image: questionImage, explanation, explanationImage }, 
                    { headers: { Authorization: `Bearer ${user.token}` } });
            }
            
            fetchQuestions(selectedQuizId);
            handleCancelEdit(); // Clears form
        } catch (e) {
            alert(e.response?.data?.message || 'Error saving question');
        }
    };
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) { setQuestionImage(''); setImagePreview(''); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); e.target.value = ''; return; }
        // Compress image using canvas to save MongoDB Atlas storage
        const img = new Image();
        const reader = new FileReader();
        reader.onloadend = () => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800; // max width or height in pixels
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                // Fill with white background to handle transparent PNGs
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                
                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                setQuestionImage(compressed);
                setImagePreview(compressed);
            };
            img.onerror = () => {
                alert('Failed to process image. Please try another one.');
                setQuestionImage('');
                setImagePreview('');
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            img.src = reader.result;
        };
        reader.onerror = () => alert('Failed to read file.');
        reader.readAsDataURL(file);
    };

    const bg = 'var(--neu-bg)';
    const labelStyle = { fontSize: 12, fontWeight: 600, color: '#7a8090', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block' };

    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                    Admin Dashboard
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>SVHEC Quiz Portal · Management Console</p>
            </div>

            {/* Registration Toggle */}
            <div style={{ ...neu.card, padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: registrationOpen ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                    }}>
                        {registrationOpen ? '🟢' : '🔴'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: registrationOpen ? '#1a7a3a' : '#cc000a' }}>
                            Registration {registrationOpen ? 'OPEN' : 'CLOSED'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            {registrationOpen ? 'New users can register' : 'Only existing users can log in'}
                        </div>
                    </div>
                </div>
                <NeuButton variant={registrationOpen ? 'danger' : 'success'} onClick={handleToggleRegistration}>
                    {registrationOpen ? '🔒 Close Registration' : '🔓 Open Registration'}
                </NeuButton>
            </div>

            {/* Tab Navigation */}
            <div style={{ ...neu.card, padding: '8px', marginBottom: 24, display: 'flex', gap: 4 }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)',
                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                        fontFamily: 'inherit', transition: 'all var(--transition-smooth)',
                        background: activeTab === tab.id ? 'linear-gradient(135deg, #6c63ff, #a29bfe)' : 'transparent',
                        color: activeTab === tab.id ? 'white' : '#7a8090',
                        boxShadow: activeTab === tab.id ? '0 4px 16px rgba(108,99,255,0.3)' : 'none'
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CREATE QUIZ TAB ── */}
            {activeTab === 'create-quiz' && (
                <div style={{ maxWidth: 850, margin: '0 auto', paddingBottom: 40 }}>
                    <div ref={formPanelRef} style={{ ...neu.card, padding: '28px 24px' }}>
                        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: 'var(--color-text-primary)' }}>
                            {editingQuizId ? `✏️ Edit Quiz: ${title}` : '＋ Create New Quiz'}
                        </h3>
                        <form onSubmit={handleCreateQuiz} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* --- BASIC INFO --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 4 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Basic Information</h4>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <NeuInput label="Quiz Title" type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. ECE Fundamentals 2026" />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <NeuInput label="Quiz Code" type="text" required value={quizCode} onChange={e => setQuizCode(e.target.value.toUpperCase())} placeholder="e.g. ECE2026" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>Description</label>
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    placeholder="Add a brief description..." 
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', outline: 'none', minHeight: 60, fontFamily: 'inherit', fontSize: 13 }}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>Instructions</label>
                                <textarea 
                                    value={instructions} 
                                    onChange={e => setInstructions(e.target.value)} 
                                    placeholder="Add instructions for takers..." 
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', outline: 'none', minHeight: 60, fontFamily: 'inherit', fontSize: 13 }}
                                />
                            </div>

                            {/* --- SCHEDULE --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Schedule & Timeline</h4>
                            </div>
                            <NeuInput label="Duration (min)" type="number" required value={duration} onChange={e => setDuration(Number(e.target.value))} min="1" />
                            <NeuInput label="Timezone" type="text" required value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="UTC" />
                            <div style={{ gridColumn: 'span 2' }}>
                                <NeuInput label="Start Time" type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>Status</label>
                                <select 
                                    value={status} 
                                    onChange={e => setStatus(e.target.value)} 
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', outline: 'none', background: 'white', fontSize: 13 }}
                                >
                                    <option value="DRAFT">Drafting (Design)</option>
                                    <option value="SCHEDULED">Scheduled</option>
                                    <option value="LIVE">In Progress (Live)</option>
                                    <option value="COMPLETED">Concluded</option>
                                </select>
                            </div>

                            {/* --- QUESTION SETTINGS --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Question Settings</h4>
                            </div>
                            <NeuInput label="Max Questions to Ask (0 for all)" type="number" required value={numberOfQuestions} onChange={e => setNumberOfQuestions(Number(e.target.value))} min="0" />
                            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                {[
                                    { id: 'randomizeQuestions', checked: randomizeQuestions, set: setRandomizeQuestions, label: 'Randomize Questions Order' },
                                    { id: 'randomizeOptions', checked: randomizeOptions, set: setRandomizeOptions, label: 'Randomize Options Order' },
                                    { id: 'allowQuestionNavigation', checked: allowQuestionNavigation, set: setAllowQuestionNavigation, label: 'Allow Question Navigation (Back/Forth)' },
                                    { id: 'allowAnswerChange', checked: allowAnswerChange, set: setAllowAnswerChange, label: 'Allow Changing Selected Answers' }
                                ].map(cfg => (
                                    <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id={cfg.id} checked={cfg.checked} onChange={e => cfg.set(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                        <label htmlFor={cfg.id} style={{ fontSize: 12.5, fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}>{cfg.label}</label>
                                    </div>
                                ))}
                            </div>

                            {/* --- SCORING --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Scoring Settings</h4>
                            </div>
                            <NeuInput label="Marks per Question" type="number" required value={marksPerQuestion} onChange={e => setMarksPerQuestion(Number(e.target.value))} min="1" />
                            <NeuInput label="Negative Marks" type="number" required value={negativeMarks} onChange={e => setNegativeMarks(Number(e.target.value))} min="0" step="0.25" disabled={!negativeMarkingEnabled} />
                            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="negativeMarkingEnabled" checked={negativeMarkingEnabled} onChange={e => setNegativeMarkingEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                <label htmlFor="negativeMarkingEnabled" style={{ fontSize: 12.5, fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}>Enable Negative Marking</label>
                            </div>

                            {/* --- SECURITY --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Security & Integrity</h4>
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { id: 'oneAttemptOnly', checked: oneAttemptOnly, set: setOneAttemptOnly, label: 'Enforce One Attempt Only per student' },
                                    { id: 'singleActiveSession', checked: singleActiveSession, set: setSingleActiveSession, label: 'Enforce Single Active Session' },
                                    { id: 'fullscreenRequired', checked: fullscreenRequired, set: setFullscreenRequired, label: 'Require Fullscreen Mode' },
                                    { id: 'tabSwitchMonitoring', checked: tabSwitchMonitoring, set: setTabSwitchMonitoring, label: 'Monitor Tab Switches & Evict' }
                                ].map(cfg => (
                                    <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id={cfg.id} checked={cfg.checked} onChange={e => cfg.set(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                        <label htmlFor={cfg.id} style={{ fontSize: 12.5, fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}>{cfg.label}</label>
                                    </div>
                                ))}
                            </div>

                            {/* --- RESULTS & MONITORING --- */}
                            <div style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 6, marginTop: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Results & Monitoring</h4>
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { id: 'liveMonitoringEnabled', checked: liveMonitoringEnabled, set: setLiveMonitoringEnabled, label: 'Enable Real-time Monitoring & Anti-cheat Banners' },
                                    { id: 'showScoreAfterSubmit', checked: showScoreAfterSubmit, set: setShowScoreAfterSubmit, label: 'Show Score Instantly After Submission' },
                                    { id: 'showCorrectAnswers', checked: showCorrectAnswers, set: setShowCorrectAnswers, label: 'Show Correct Answers on Results Page' },
                                    { id: 'showExplanations', checked: showExplanations, set: setShowExplanations, label: 'Show Explanations on Results Page' },
                                    { id: 'allowQuestionImages', checked: allowQuestionImages, set: setAllowQuestionImages, label: 'Allow Question Images' }
                                ].map(cfg => (
                                    <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id={cfg.id} checked={cfg.checked} onChange={e => cfg.set(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                        <label htmlFor={cfg.id} style={{ fontSize: 12.5, fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}>{cfg.label}</label>
                                    </div>
                                ))}
                            </div>

                            {/* --- QUESTIONS IMPORT SECTION (NEW QUIZ ONLY) --- */}
                            {!editingQuizId && (
                                <div style={{ gridColumn: 'span 2', marginTop: 12, borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase' }}>Questions (Optional)</h4>
                                            <p style={{ margin: '4px 0 0 0', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                                                {importedQuestions.length > 0 
                                                    ? `⚡ ${importedQuestions.length} questions buffered for creation.` 
                                                    : 'Import questions from document files to automatically load them into this quiz.'}
                                            </p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsImportModalOpen(true)}
                                            style={{
                                                padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(108,99,255,0.3)',
                                                background: 'rgba(108,99,255,0.06)', color: 'var(--brand-accent)',
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer'
                                            }}
                                        >
                                            📥 Import Questions
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                                {editingQuizId && (
                                    <NeuButton type="button" onClick={handleCancelEditQuiz} variant="secondary">Cancel</NeuButton>
                                )}
                                <NeuButton type="submit" variant="primary">
                                    {editingQuizId ? 'Update Quiz ✓' : 'Create Quiz →'}
                                </NeuButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── QUIZZES TAB (LIST & LIVE MONITOR) ── */}
            {activeTab === 'quizzes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }} className="responsive-grid">
                    {/* Left Column: Management & Monitor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Quiz List */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)', margin: 0 }}>All Quizzes</h3>
                                <NeuButton small onClick={() => setActiveTab('create-quiz')}>＋ Create New Quiz</NeuButton>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {quizzes.length === 0 && (
                                    <div style={{ ...neu.card, padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                                        No quizzes yet. Create your first quiz using the tab above.
                                    </div>
                                )}
                                {quizzes.map(quiz => (
                                    <div key={quiz._id} style={{ ...neu.card, padding: '18px 22px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{quiz.title}</span>
                                                    <span style={{
                                                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                                                        background: quiz.status === 'LIVE' ? 'rgba(48,209,88,0.1)' : 
                                                                    quiz.status === 'SCHEDULED' ? 'rgba(255,159,10,0.1)' :
                                                                    quiz.status === 'COMPLETED' ? 'rgba(113,128,150,0.1)' : 'rgba(108,99,255,0.1)',
                                                        color: quiz.status === 'LIVE' ? '#1a7a3a' :
                                                               quiz.status === 'SCHEDULED' ? '#b25e00' :
                                                               quiz.status === 'COMPLETED' ? '#4a5568' : 'var(--brand-accent)'
                                                    }}>
                                                        {quiz.status === 'LIVE' ? '🟢 In Progress' :
                                                         quiz.status === 'SCHEDULED' ? '📅 Scheduled' :
                                                         quiz.status === 'COMPLETED' ? '🔒 Concluded' : '📝 Drafting'}
                                                    </span>
                                                    {quiz.resultsPublished && <span className="badge badge-info" style={{ fontSize: 11 }}>Results ✓</span>}
                                                    {quiz.leaderboardPublished && <span className="badge badge-success" style={{ fontSize: 11 }}>Board ✓</span>}
                                                    {quiz.liveMonitoringEnabled && <span className="badge badge-warning" style={{ fontSize: 11, background: 'rgba(255,159,10,0.12)', color: '#b25e00' }}>📡 Monitoring Enabled</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                                                    <span>🕐 {quiz.duration} min</span>
                                                    <span>🔑 {quiz.quizCode}</span>
                                                    {quiz.startTime && <span>📅 {(() => {
                                                        try {
                                                            return new Date(quiz.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                                                        } catch (e) {
                                                            return String(quiz.startTime);
                                                        }
                                                    })()}</span>}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <NeuButton small onClick={() => fetchLiveAttendees(quiz._id)}>👥 Attendees</NeuButton>
                                                <div style={{ position: 'relative' }} ref={openDropdownId === quiz._id ? dropdownRef : null}>
                                                    <NeuButton small onClick={() => toggleDropdown(quiz._id)}>⋯ More</NeuButton>
                                                    {openDropdownId === quiz._id && (
                                                        <div style={{
                                                            position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 50,
                                                            ...neu.card, padding: '8px', minWidth: 200,
                                                            display: 'flex', flexDirection: 'column', gap: 4
                                                        }}>
                                                            {[
                                                                { icon: '⚙️', label: 'Edit Settings', action: () => { handleEditQuizClick(quiz); setOpenDropdownId(null); } },
                                                                { icon: '👁', label: 'Admin Preview', action: () => { window.open(`/quiz/${quiz.quizCode}?preview=true`, '_blank'); setOpenDropdownId(null); } },
                                                                { icon: quiz.resultsPublished ? '🙈' : '📤', label: quiz.resultsPublished ? 'Hide Results' : 'Publish Results', action: () => handleToggleResults(quiz._id) },
                                                                { icon: quiz.leaderboardPublished ? '🙈' : '🏆', label: quiz.leaderboardPublished ? 'Hide Leaderboard' : 'Publish Leaderboard', action: () => handleToggleLeaderboard(quiz._id) },
                                                                ...(new Date().getTime() < new Date(quiz.startTime).getTime() ? [
                                                                    { icon: '📡', label: quiz.liveMonitoringEnabled ? 'Disable Monitoring' : 'Enable Monitoring', action: () => handleToggleMonitoring(quiz._id) }
                                                                ] : []),
                                                                { icon: '⏹', label: 'Stop Quiz', action: () => handleStopQuiz(quiz._id), color: '#cc000a' },
                                                                { icon: '🗑', label: 'Delete Quiz', action: () => handleDeleteQuiz(quiz._id), color: '#cc000a' },
                                                            ].map(item => (
                                                                <button key={item.label} onClick={item.action} style={{
                                                                    padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
                                                                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                                                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                                                                    color: item.color || 'var(--color-text-primary)',
                                                                    transition: 'background var(--transition-fast)'
                                                                }}
                                                                onMouseEnter={e => e.target.style.background = 'rgba(0,0,0,0.04)'}
                                                                onMouseLeave={e => e.target.style.background = 'transparent'}>
                                                                    {item.icon} {item.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Live Monitoring Dashboard */}
                        {attendees && selectedQuizForAttendees && (
                            <div style={{ ...neu.card, padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                        <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                                            👥 Monitoring: {quizzes.find(q => q._id === selectedQuizForAttendees)?.title || 'Live Session'}
                                        </h3>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
                                            {attendees.activeCount > 0 && <span style={{ color: '#1a7a3a' }}>🟢 {attendees.activeCount} active</span>}
                                            <span style={{ color: '#8090a0' }}>Status: {attendeesTotal} Joined / {attendees.totalUsers} Total</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <NeuButton small onClick={async () => {
                                            const testAlert = {
                                                id: `test-${Date.now()}`,
                                                userName: 'SYSTEM TEST',
                                                flagType: 'fullscreen_exit',
                                                flagCount: 1,
                                                receivedAt: new Date()
                                            };
                                            setFlagAlerts(prev => [testAlert, ...prev].slice(0, 50));
                                        }}>🧪 Test UI</NeuButton>
                                        <NeuButton small onClick={() => fetchLiveAttendees(selectedQuizForAttendees)}>🔄 Refresh</NeuButton>
                                        <NeuButton small onClick={() => { setAttendees(null); setSelectedQuizForAttendees(null); setFlagAlerts([]); if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } }}>✕ Close</NeuButton>
                                    </div>
                                </div>

                                {/* Security Feed Sub-Panel */}
                                <div style={{ ...neu.inset, padding: '20px', marginBottom: 24, background: 'rgba(255,255,255,0.4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ 
                                                width: 10, height: 10, borderRadius: '50%', 
                                                background: socketConnected ? '#30d158' : '#ff3b30', 
                                                boxShadow: socketConnected ? '0 0 10px #30d158' : '0 0 10px #ff3b30',
                                                animation: socketConnected ? 'pulse 1.5s infinite' : 'none' 
                                            }} />
                                            <h4 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111' }}>
                                                Security Monitoring
                                            </h4>
                                        </div>
                                        <div style={{ 
                                            fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
                                            background: socketConnected ? 'rgba(48,209,88,0.1)' : 'rgba(255,59,48,0.1)',
                                            color: socketConnected ? '#1a7a3a' : '#cc000a'
                                        }}>
                                            {socketConnected ? '🟢 SYSTEM CONNECTED' : '🔴 LINK INTERRUPTED'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                                        <AnimatePresence mode="popLayout" initial={false}>
                                            {flagAlerts.length === 0 ? (
                                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                    <div style={{ color: '#cbd5e0', marginBottom: 12 }}><ShieldAlert size={36} strokeWidth={1.5} /></div>
                                                    <p style={{ fontSize: 13, color: '#8090a0', fontWeight: 600 }}>Waiting for real-time security events...</p>
                                                </motion.div>
                                            ) : (
                                                flagAlerts.map((alert) => (
                                                    <motion.div
                                                        key={alert.id}
                                                        initial={{ x: -20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        exit={{ x: 20, opacity: 0 }}
                                                        layout
                                                        style={{
                                                            padding: '14px 16px', borderRadius: 16, background: 'white',
                                                            border: `1px solid ${alert.flagCount >= 3 ? 'rgba(255,59,48,0.15)' : 'rgba(0,0,0,0.03)'}`,
                                                            display: 'flex', alignItems: 'center', gap: 14,
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                                        }}
                                                    >
                                                        <div style={{ 
                                                            width: 40, height: 40, borderRadius: '50%', 
                                                            background: alert.flagCount >= 3 ? '#ff3b30' : 'var(--brand-accent)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                                        }}>
                                                            <ShieldAlert size={20} strokeWidth={2.5} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{alert.userName}</span>
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#8090a0' }}>{new Date(alert.timestamp || alert.receivedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                                <span style={{ 
                                                                    fontSize: 10, fontWeight: 900, textTransform: 'uppercase', 
                                                                    color: alert.flagCount >= 3 ? '#ff3b30' : '#444'
                                                                }}>
                                                                    {alert.flagType?.replace('_',' ').toUpperCase() || 'SECURITY ALERT'}
                                                                </span>
                                                                <span style={{ opacity: 0.2 }}>|</span>
                                                                <span style={{ fontSize: 10, fontWeight: 800, background: alert.flagCount >= 3 ? '#ff3b30' : 'rgba(0,0,0,0.05)', color: alert.flagCount >= 3 ? 'white' : '#718096', padding: '1px 6px', borderRadius: 4 }}>
                                                                    FLAG #{alert.flagCount}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Fallback Banner when Live Monitoring is Disabled */}
                                {!attendees.liveMonitoringEnabled && (
                                    <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: 16, marginBottom: 20 }}>
                                        <p style={{ fontSize: 13, color: '#b25e00', fontWeight: 600, margin: 0 }}>
                                            ⚠️ Live monitoring is disabled for this quiz. Real-time statistics, anti-cheat tracking, and remote student actions are unavailable.
                                        </p>
                                    </div>
                                )}

                                {/* Live Metrics (only displayed if monitoring is enabled) */}
                                {attendees.liveMonitoringEnabled && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 20 }}>
                                        {[
                                            { label: 'Total', count: stats.total, color: '#4a5568', bg: 'rgba(74,85,104,0.08)' },
                                            { label: 'Connected', count: stats.connected, color: '#30d158', bg: 'rgba(48,209,88,0.08)' },
                                            { label: 'Reconnecting', count: stats.reconnecting, color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)' },
                                            { label: 'Offline', count: stats.offline, color: '#ff3b30', bg: 'rgba(255,59,48,0.08)' },
                                            { label: 'Submitted', count: stats.submitted, color: '#6c63ff', bg: 'rgba(108,99,255,0.08)' },
                                            { label: 'Expired', count: stats.expired, color: '#718096', bg: 'rgba(113,128,150,0.08)' },
                                            { label: 'Suspicious', count: stats.suspicious, color: '#cc000a', bg: 'rgba(204,0,10,0.08)' },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: item.bg, padding: '12px 14px', borderRadius: 14, textAlign: 'center', border: '1px solid rgba(0,0,0,0.02)' }}>
                                                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#718096', marginBottom: 4 }}>{item.label}</div>
                                                <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.count}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Search & Filters */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <input 
                                            type="text" 
                                            placeholder="🔍 Search student name or email..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)} 
                                            style={{
                                                width: '100%', padding: '10px 16px', borderRadius: 14, 
                                                border: '1px solid rgba(0,0,0,0.08)', fontSize: 13, fontWeight: 500,
                                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)', outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {['all', 'active', 'offline', 'submitted', 'suspicious'].map(f => (
                                            <button 
                                                key={f} 
                                                onClick={() => setFilter(f)} 
                                                style={{
                                                    padding: '8px 14px', borderRadius: 10, border: 'none',
                                                    background: filter === f ? 'var(--brand-accent)' : 'rgba(0,0,0,0.04)',
                                                    color: filter === f ? 'white' : '#4a5568',
                                                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                                    textTransform: 'capitalize', transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Attendee List Table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
                                                {['Name', 'Connection', 'Progress', 'Flags', 'Score', 'Actions'].map(h => (
                                                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAttendees.map((a, i) => (
                                                <tr key={a._id || i} style={{ 
                                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                                    background: a.flagCount >= 3 ? 'rgba(255,59,48,0.03)' : 'transparent',
                                                    transition: 'background 0.3s ease'
                                                }}>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        <div style={{ fontWeight: 700, color: '#111' }}>{a.name || 'Anonymous'}</div>
                                                        <div style={{ fontSize: 10, color: '#718096' }}>{a.email}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        {a.status === 'submitted' ? (
                                                            <span style={{ color: '#6c63ff', fontWeight: 800, fontSize: 11 }}>—</span>
                                                        ) : a.connectionStatus === 'CONNECTED' ? (
                                                            <span style={{ color: '#30d158', fontWeight: 800, fontSize: 11 }}>🟢 CONNECTED</span>
                                                        ) : a.connectionStatus === 'RECONNECTING' ? (
                                                            <span style={{ color: '#ff9f0a', fontWeight: 800, fontSize: 11 }}>🟠 RECONNECTING</span>
                                                        ) : (
                                                            <span style={{ color: '#ff3b30', fontWeight: 800, fontSize: 11 }}>🔴 OFFLINE</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        {a.status === 'submitted' ? (
                                                            <span style={{ color: '#6c63ff', fontWeight: 800, fontSize: 11 }}>✅ SUBMITTED</span>
                                                        ) : a.status === 'expired' ? (
                                                            <span style={{ color: '#718096', fontWeight: 800, fontSize: 11 }}>⏰ EXPIRED</span>
                                                        ) : (
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: '#2d3748' }}>Q{a.currentQuestionIndex + 1} ({a.answeredCount} ans)</div>
                                                                <div style={{ fontSize: 10, color: '#718096' }}>
                                                                    {a.remainingSeconds > 0 ? (
                                                                        <>⏰ {Math.floor(a.remainingSeconds / 60)}:{String(a.remainingSeconds % 60).padStart(2, '0')}</>
                                                                    ) : 'Expired'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        {a.flagCount > 0 ? 
                                                            <span style={{ fontWeight: 900, color: a.flagCount >= 3 ? '#cc000a' : '#ff9f0a', fontSize: 14 }}>🚩 {a.flagCount}</span> : 
                                                            <span style={{ color: '#cbd5e0' }}>0</span>
                                                        }
                                                    </td>
                                                    <td style={{ padding: '14px 10px', fontWeight: 900, color: 'var(--brand-accent)', fontSize: 15 }}>{a.score !== null ? a.score : '—'}</td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <NeuButton small onClick={() => setSelectedAttendee(a)}>👁 Details</NeuButton>
                                                            {attendees.liveMonitoringEnabled && a.status !== 'submitted' && a.attemptId && (
                                                                <>
                                                                    <NeuButton small onClick={() => handleForceSubmit(a.attemptId)} style={{ background: '#ff9f0a', color: 'white', border: 'none' }}>Force</NeuButton>
                                                                    <NeuButton small onClick={() => handleInvalidateSession(a.attemptId)} style={{ background: '#ff3b30', color: 'white', border: 'none' }}>Kick</NeuButton>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredAttendees.length === 0 && (
                                                <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#a0aec0', fontWeight: 600 }}>No matching students found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {renderPagination(attendeesPage, attendeesPages, (p) => fetchLiveAttendees(selectedQuizForAttendees, p))}

                                {/* Modal for view details */}
                                {selectedAttendee && (
                                    <div style={{
                                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                                        background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: 20
                                    }} onClick={() => setSelectedAttendee(null)}>
                                        <div style={{
                                            ...neu.card, padding: 24, maxWidth: 500, width: '100%', background: 'white',
                                            maxHeight: '80vh', overflowY: 'auto'
                                        }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                                <div>
                                                    <h3 style={{ fontWeight: 800, fontSize: 18, color: '#111', margin: 0 }}>{selectedAttendee.name}</h3>
                                                    <p style={{ fontSize: 12, color: '#718096', margin: 0 }}>{selectedAttendee.email}</p>
                                                </div>
                                                <NeuButton small onClick={() => setSelectedAttendee(null)}>✕ Close</NeuButton>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                                                <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{selectedAttendee.status}</span></div>
                                                <div><strong>Connection Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{selectedAttendee.connectionStatus || 'UNKNOWN'}</span></div>
                                                <div><strong>Started At:</strong> {selectedAttendee.startedAt ? new Date(selectedAttendee.startedAt).toLocaleString() : 'N/A'}</div>
                                                <div><strong>Last Seen At:</strong> {selectedAttendee.lastSeenAt ? new Date(selectedAttendee.lastSeenAt).toLocaleString() : 'N/A'}</div>
                                                <div><strong>Flag Count:</strong> <span style={{ color: '#cc000a', fontWeight: 700 }}>{selectedAttendee.flagCount}</span></div>
                                                
                                                <div>
                                                    <strong>Flags History:</strong>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxHeight: 150, overflowY: 'auto', background: 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 10 }}>
                                                        {selectedAttendee.flagEvents?.length === 0 ? (
                                                            <span style={{ color: '#a0aec0', fontSize: 12 }}>No flags reported for this session.</span>
                                                        ) : (
                                                            selectedAttendee.flagEvents?.map((evt, idx) => (
                                                                <div key={idx} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontWeight: 600 }}>{evt.type?.replace('_', ' ').toUpperCase()}</span>
                                                                    <span style={{ color: '#718096' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recent Alerts Quick Preview */}
                        <div style={{ ...neu.inset, padding: '16px', borderRadius: 20, textAlign: 'center' }}>
                            <p style={{ fontSize: 11, color: '#8090a0', fontWeight: 600 }}>System Status: <span style={{ color: '#30d158' }}>Nominal</span></p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── QUESTIONS TAB ── */}
            {activeTab === 'questions' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 24,
                    height: 'calc(100vh - 220px)',
                    minHeight: 500,
                    overflow: 'hidden', // The container itself must NOT scroll
                }}>
                    {/* ── LEFT PANEL: Question List ── */}
                    <div
                        ref={questionListRef}
                        style={{
                            flex: '1 1 0',
                            minWidth: 0,
                            ...neu.card,
                            padding: '24px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        className="custom-scrollbar"
                    >
                        {/* Sticky header inside left panel */}
                        <div 
                            data-guide="questions-header"
                            style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0
                            }}
                        >
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)', margin: 0 }}>Questions Directory</h3>
                                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, marginBottom: 0 }}>
                                    {selectedQuizId ? 'Viewing questions for selected quiz' : 'Select a quiz to view questions'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {selectedQuizId && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button 
                                            data-guide="guide-me-btn"
                                            type="button"
                                            onClick={() => startGuide('question-management')}
                                            style={{ 
                                                padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(108,99,255,0.2)', 
                                                background: 'white', color: 'var(--brand-accent)', 
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                            }}
                                        >
                                            📖 Guide Me
                                        </button>
                                        <button 
                                            data-guide="import-mcq-btn"
                                            type="button"
                                            onClick={() => setIsImportModalOpen(true)}
                                            style={{ 
                                                padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(108,99,255,0.3)', 
                                                background: 'rgba(108,99,255,0.07)', color: 'var(--brand-accent)', 
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                            }}
                                        >
                                            📥 Import MCQ
                                        </button>
                                    </div>
                                )}
                                <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--neu-bg)', padding: '4px 10px', borderRadius: 20, color: 'var(--brand-accent)' }}>
                                    {questionsList.length} Items
                                </span>
                            </div>
                        </div>

                        {/* Scrollable question list body */}
                        <div style={{ flex: 1, minHeight: 0 }}>
                            {!selectedQuizId ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8090a0', fontSize: 13 }}>
                                    Please select a quiz on the right to manage its questions.
                                </div>
                            ) : questionsList.length === 0 ? (
                                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8090a0', fontSize: 13.5, fontWeight: 600 }}>
                                    No questions found for this quiz. Add one manually using the form on the right, or click "Import MCQ" to upload documents.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {questionsList.map((q, idx) => (
                                        <div
                                            key={q._id}
                                            data-qid={q._id}
                                            style={{
                                                ...neu.inset,
                                                padding: '20px',
                                                borderRadius: 16,
                                                border: editingQuestionId === q._id ? '1.5px solid rgba(108,99,255,0.35)' : '1.5px solid transparent',
                                                background: editingQuestionId === q._id ? 'rgba(108,99,255,0.04)' : 'var(--neu-bg)',
                                                transition: 'border 0.2s, background 0.2s',
                                            }}
                                        >
                                            {/* Question header row: number + text + action buttons */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                                {/* Index badge */}
                                                <span style={{
                                                    flexShrink: 0,
                                                    width: 28, height: 28, borderRadius: 8,
                                                    background: 'var(--brand-accent)',
                                                    color: 'white', fontWeight: 800, fontSize: 13,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>{idx + 1}</span>
                                                {/* Question text — fills available width */}
                                                <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: '#111', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                                    {q.question}
                                                </div>
                                                {/* Action buttons — always pinned top-right, never shift */}
                                                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'flex-start' }}>
                                                    <button
                                                        onClick={() => handleEditQuestionClick(q)}
                                                        style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(0,122,255,0.3)', background: 'rgba(0,122,255,0.07)', color: '#007aff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                                    >Edit</button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(q._id)}
                                                        style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(204,0,10,0.25)', background: 'rgba(204,0,10,0.07)', color: '#cc000a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                                    >Delete</button>
                                                </div>
                                            </div>

                                            {/* Optional image */}
                                            {q.image && (
                                                <div style={{ marginBottom: 14 }}>
                                                    <img src={q.image} alt="Question" style={{ maxHeight: 110, borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', objectFit: 'contain' }} />
                                                </div>
                                            )}

                                            {/* Options list */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                {q.options.map((opt, i) => {
                                                    const isCorrect = opt === q.correctAnswer;
                                                    return (
                                                        <div key={i} style={{
                                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                                            padding: '9px 13px', borderRadius: 8, lineHeight: 1.45,
                                                            background: isCorrect ? 'rgba(48,209,88,0.11)' : 'rgba(0,0,0,0.02)',
                                                            border: isCorrect ? '1px solid rgba(48,209,88,0.35)' : '1px solid rgba(0,0,0,0.04)',
                                                            color: isCorrect ? '#1a7a3a' : '#555',
                                                            fontWeight: isCorrect ? 700 : 500, fontSize: 13,
                                                        }}>
                                                            <span style={{ flexShrink: 0, fontWeight: 800, color: isCorrect ? '#1a7a3a' : '#8090a0' }}>{['A','B','C','D'][i]}.</span>
                                                            <span style={{ flex: 1, wordBreak: 'break-word' }}>{opt}</span>
                                                            {isCorrect && <span style={{ flexShrink: 0, fontSize: 11, color: '#1a7a3a' }}>✓ Correct</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT PANEL: Add / Edit Form ── */}
                    <div
                        ref={formPanelRef}
                        style={{
                            width: 400,
                            flexShrink: 0,
                            ...neu.card,
                            padding: '24px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        className="custom-scrollbar"
                    >
                        {/* Form header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: editingQuestionId ? '#007aff' : 'inherit' }}>
                                    {editingQuestionId ? '✎ Edit Question' : '＋ Add Question'}
                                </h3>
                                <button 
                                    type="button"
                                    onClick={() => startGuide('manual-question-entry')}
                                    style={{ 
                                        padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(108,99,255,0.2)', 
                                        background: 'white', color: 'var(--brand-accent)', 
                                        fontSize: 10.5, fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    📖 Guide
                                </button>
                            </div>
                            {editingQuestionId && (
                                <button onClick={handleCancelEdit} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8090a0', fontSize: 12, fontWeight: 700 }}>✕ Cancel</button>
                            )}
                        </div>

                        {quizzes.length === 0 ? (
                            <p style={{ color: 'var(--color-danger)' }}>Please create a quiz first.</p>
                        ) : (
                            <form onSubmit={handleAddOrEditQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {/* Quiz selector */}
                                <div>
                                    <label style={labelStyle}>Target Quiz</label>
                                    <select
                                        data-guide="select-quiz-prompt"
                                        value={selectedQuizId}
                                        onChange={e => setSelectedQuizId(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-md)',
                                            boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.85)',
                                            fontSize: 14, fontFamily: 'inherit', color: 'var(--color-text-primary)', outline: 'none'
                                        }}
                                    >
                                        <option value="" disabled>Select a quiz...</option>
                                        {quizzes.map(q => <option key={q._id} value={q._id}>{q.title}</option>)}
                                    </select>
                                </div>

                                <NeuInput data-guide="manual-question-text" label="Question Text" type="text" required value={question} onChange={e => setQuestion(e.target.value)} placeholder="Enter the question" />

                                {/* Image upload */}
                                <div>
                                    <label style={labelStyle}>Question Image (optional)</label>
                                    <input
                                        ref={fileInputRef}
                                        type="file" accept="image/*" onChange={handleImageChange}
                                        style={{
                                            width: '100%', padding: '10px 14px',
                                            background: 'var(--neu-bg)', border: 'none', borderRadius: 'var(--radius-md)',
                                            boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.85)',
                                            fontSize: 13, fontFamily: 'inherit', color: 'var(--color-text-primary)', cursor: 'pointer'
                                        }}
                                    />
                                    {imagePreview && (
                                        <div style={{ marginTop: 12, position: 'relative', display: 'inline-block' }}>
                                            <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, border: '2px solid rgba(108,99,255,0.2)' }} />
                                            <button type="button" onClick={() => { setQuestionImage(''); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{
                                                position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%',
                                                background: '#ff3b30', color: 'white', border: 'none', cursor: 'pointer',
                                                fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(255,59,48,0.4)'
                                            }}>×</button>
                                        </div>
                                    )}
                                </div>

                                {/* Options — click letter badge to set correct answer */}
                                <div>
                                    <label style={labelStyle}>Options <span style={{ fontSize: 10, color: '#8090a0', fontWeight: 'normal', textTransform: 'none' }}>(Click letter to set correct)</span></label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {options.map((opt, i) => {
                                            const isCorrect = correctAnswer && correctAnswer === opt && opt.trim() !== '';
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <button
                                                        data-guide={i === 0 ? "manual-correct-answer" : undefined}
                                                        type="button"
                                                        onClick={() => opt.trim() && setCorrectAnswer(opt)}
                                                        title="Set as correct answer"
                                                        style={{
                                                            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
                                                            background: isCorrect ? '#30d158' : 'var(--neu-bg)',
                                                            color: isCorrect ? 'white' : 'var(--color-text-secondary)',
                                                            fontWeight: 800, fontSize: 13,
                                                            boxShadow: isCorrect
                                                                ? '3px 3px 8px rgba(48,209,88,0.3)'
                                                                : '3px 3px 8px var(--neu-dark), -3px -3px 8px var(--neu-light)',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    >
                                                        {['A','B','C','D'][i]}
                                                    </button>
                                                    <input
                                                        data-guide={`manual-option-${i}`}
                                                        type="text" required value={opt}
                                                        onChange={e => {
                                                            const newOpt = e.target.value;
                                                            const oldOpt = options[i];
                                                            const n = [...options];
                                                            n[i] = newOpt;
                                                            setOptions(n);
                                                            if (correctAnswer === oldOpt && oldOpt !== '') setCorrectAnswer(newOpt);
                                                        }}
                                                        placeholder={`Option ${['A','B','C','D'][i]}`}
                                                        style={{
                                                            flex: 1, padding: '10px 14px',
                                                            background: 'var(--neu-bg)',
                                                            border: isCorrect ? '1px solid rgba(48,209,88,0.4)' : '1px solid transparent',
                                                            borderRadius: 'var(--radius-sm)',
                                                            boxShadow: 'inset 3px 3px 8px rgba(163,177,198,0.5), inset -3px -3px 8px rgba(255,255,255,0.8)',
                                                            fontSize: 14, fontFamily: 'inherit', outline: 'none',
                                                            color: isCorrect ? '#1a7a3a' : 'var(--color-text-primary)'
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={labelStyle}>Explanation (Optional)</label>
                                        <textarea 
                                            data-guide="manual-explanation"
                                            value={explanation} 
                                            onChange={e => setExplanation(e.target.value)} 
                                            placeholder="Provide correct answer explanation..." 
                                            style={{ 
                                                width: '100%', padding: '10px 14px', borderRadius: 10, 
                                                border: '1px solid rgba(0,0,0,0.08)', outline: 'none', 
                                                minHeight: 60, fontFamily: 'inherit', fontSize: 13 
                                            }} 
                                        />
                                    </div>
                                    <NeuInput 
                                        label="Explanation Image URL (optional)" 
                                        type="text" 
                                        value={explanationImage} 
                                        onChange={e => setExplanationImage(e.target.value)} 
                                        placeholder="https://example.com/image.png" 
                                    />
                                </div>

                                <NeuButton data-guide="manual-save-btn" type="submit" variant={editingQuestionId ? 'primary' : 'success'} style={{ marginTop: 4 }}>
                                    {editingQuestionId ? '✓ Save Changes' : '＋ Add Question'}
                                </NeuButton>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── RESULTS TAB ── */}
            {activeTab === 'results' && (
                <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>All Submissions ({resultsTotal} total)</h3>
                    <div style={{ ...neu.card, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                                    {['Name', 'Quiz', 'Score', 'Suspicious', 'Submitted'].map(h => (
                                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={r._id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background var(--transition-fast)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>{r.userId?.name || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)' }}>{r.quizId?.title || '—'}</td>
                                        <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--brand-accent)', fontSize: 16 }}>{r.score}</td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {r.isSuspicious
                                                ? <span style={{ color: '#cc000a', background: 'rgba(255,69,58,0.1)', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>🚩 Flagged</span>
                                                : <span style={{ color: '#1a7a3a', fontSize: 12 }}>✓ Clean</span>}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                                            {(() => {
                                                try {
                                                    return new Date(r.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                                                } catch (e) {
                                                    return String(r.submittedAt);
                                                }
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                                {results.length === 0 && <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No submissions yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination(resultsPage, resultsPages, setResultsPage)}
                </div>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === 'users' && (
                <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 12 }}>
                        <button 
                            onClick={() => setUserSubTab('approved')} 
                            className={`btn btn-sm btn-pill ${userSubTab === 'approved' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            📋 Approved Students
                        </button>
                        <button 
                            onClick={() => setUserSubTab('pending')} 
                            className={`btn btn-sm btn-pill ${userSubTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            ⏳ Requested Students 
                            {pendingTotal > 0 && (
                                <span style={{ background: '#ff3b30', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                                    {pendingTotal}
                                </span>
                            )}
                        </button>
                    </div>

                    {userSubTab === 'pending' && (
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Filter Year</label>
                                <select 
                                    value={filterYear} 
                                    onChange={e => { setFilterYear(e.target.value); setPendingPage(1); }}
                                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'white', fontSize: 13, outline: 'none' }}
                                >
                                    <option value="">All Years</option>
                                    <option value="I">I Year</option>
                                    <option value="II">II Year</option>
                                    <option value="III">III Year</option>
                                    <option value="IV">IV Year</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Filter Department</label>
                                <select 
                                    value={filterDept} 
                                    onChange={e => { setFilterDept(e.target.value); setPendingPage(1); }}
                                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'white', fontSize: 13, outline: 'none' }}
                                >
                                    <option value="">All Departments</option>
                                    <option value="ECE">ECE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="CSE">CSE</option>
                                    <option value="IT">IT</option>
                                    <option value="AIDS">AIDS</option>
                                    <option value="BME">BME</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {userSubTab === 'approved' ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Approved Users Directory</h3>
                                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{usersTotal} users registered</span>
                            </div>
                            <div style={{ ...neu.card, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                                            {['#', 'Name', 'Email', 'Register No', 'Year/Dept', 'College', 'Status', 'Action'].map(h => (
                                                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u, i) => (
                                            <tr key={u._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: u.isBlocked ? 'rgba(255,69,58,0.02)' : 'transparent' }}>
                                                <td style={{ padding: '14px 20px', color: '#bbb', fontWeight: 600 }}>{((usersPage - 1) * 10) + i + 1}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-accent), #a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                                                            {u.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{u.email}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>{u.registerNumber || '—'}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                                                    {u.year && u.department ? `${u.year} Year / ${u.department}` : '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px', color: '#555' }}>
                                                    {u.college === 'Others' ? u.otherCollegeName || 'Others' : u.college || '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    {u.isBlocked
                                                        ? <span style={{ color: '#cc000a', fontWeight: 700, fontSize: 12 }}>🚫 Blocked</span>
                                                        : <span style={{ color: '#1a7a3a', fontWeight: 600, fontSize: 12 }}>✓ Active</span>}
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    {u.role !== 'admin' && (
                                                        u.isBlocked
                                                            ? <NeuButton small variant="success" onClick={() => handleUnblockUser(u._id)}>Unblock</NeuButton>
                                                            : <NeuButton small variant="danger" onClick={() => handleBlockUser(u._id)}>Block</NeuButton>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No users registered yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            {renderPagination(usersPage, usersPages, setUsersPage)}
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Pending Approval Queue</h3>
                                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{pendingTotal} verification requests</span>
                            </div>
                            <div style={{ ...neu.card, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                                            {['#', 'Name', 'Email', 'Register No', 'Year/Dept', 'College', 'Actions'].map(h => (
                                                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8090a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingUsers.map((u, i) => (
                                            <tr key={u._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                                <td style={{ padding: '14px 20px', color: '#bbb', fontWeight: 600 }}>{((pendingPage - 1) * 10) + i + 1}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                                                            {u.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{u.email}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>{u.registerNumber || '—'}</td>
                                                <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                                                    {u.year && u.department ? `${u.year} Year / ${u.department}` : '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px', color: '#555' }}>
                                                    {u.college === 'Others' ? u.otherCollegeName || 'Others' : u.college || '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <NeuButton small variant="success" onClick={() => handleApproveUser(u._id)}>✓ Approve</NeuButton>
                                                        <NeuButton small variant="danger" onClick={() => handleRejectUser(u._id)}>✕ Reject</NeuButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {pendingUsers.length === 0 && <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No pending validation requests.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            {renderPagination(pendingPage, pendingPages, setPendingPage)}
                        </>
                    )}
                </div>
            )}
            <ImportQuestionsModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                quizId={activeTab === 'quizzes' ? null : selectedQuizId} 
                token={user.token} 
                onImportSuccess={handleImportSuccess} 
            />

            {/* Guided Tour Component will render globally via GuideProvider */}
        </div>
    );

    function toggleDropdown(quizId) {
        setOpenDropdownId(openDropdownId === quizId ? null : quizId);
    }
};

const AdminDashboardWrapper = (props) => {
    return (
        <GuideProvider>
            <AdminDashboard {...props} />
        </GuideProvider>
    );
};

export default AdminDashboardWrapper;
