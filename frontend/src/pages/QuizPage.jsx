import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';
import { io } from 'socket.io-client';

/* ── Confetti ─────────────────────────────────────────── */
const COLORS = ['#6c63ff','#a29bfe','#fd79a8','#fdcb6e','#00b894','#e17055','#74b9ff','#ff7675'];
const Confetti = () => {
    const [pieces, setPieces] = useState([]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setPieces(Array.from({ length: 55 }, (_, i) => ({
                id: i, left: Math.random() * 100,
                delay: Math.random() * 2.5, duration: 2.4 + Math.random() * 2,
                color: COLORS[i % COLORS.length], size: 7 + Math.random() * 8,
                round: Math.random() > 0.5,
            })));
        }, 0);
        return () => clearTimeout(timer);
    }, []);
    return <>
        {pieces.map(p => (
            <div key={p.id} className="confetti" style={{
                left: `${p.left}%`, top: '-10px',
                width: p.size, height: p.size,
                borderRadius: p.round ? '50%' : 3,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
            }} />
        ))}
    </>;
};

/* ── IndexedDB Configuration ──────────────────────────── */
const DB_NAME = 'QuizAppDB';
const STORE_NAME = 'answers';

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'questionId' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveLocalAnswer = async (db, answer) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(answer);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const getLocalAnswers = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

const deleteLocalAnswersForAttempt = async (db, attemptId) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result || [];
            items.forEach(item => {
                if (item.attemptId === attemptId) {
                    store.delete(item.questionId);
                }
            });
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
};

const syncLocalAnswersWithState = async (db, currentAttemptId, serverAnswers) => {
    try {
        const local = await getLocalAnswers(db);
        const mergedAnswers = { ...serverAnswers };
        let localAnswersToSync = [];

        local.forEach(item => {
            if (item.attemptId === currentAttemptId) {
                mergedAnswers[item.questionId] = item.selectedOption;
                if (item.syncStatus !== 'synced') {
                    localAnswersToSync.push(item);
                }
            }
        });

        return { mergedAnswers, localAnswersToSync };
    } catch (err) {
        console.error('Failed to merge local IndexedDB answers', err);
        return { mergedAnswers: serverAnswers, localAnswersToSync: [] };
    }
};

/* ── Main Component ───────────────────────────────────── */
const QuizPage = () => {
    const { quizCode } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0);
    const timeLeftRef = useRef(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [quizStarted, setQuizStarted] = useState(false);
    const [flagCount, setFlagCount] = useState(0);
    const [warningMsg, setWarningMsg] = useState('');
    const [isResuming, setIsResuming] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [currentQ, setCurrentQ] = useState(0);
    const [isStarting, setIsStarting] = useState(false);

    const [syncStatus, setSyncStatus] = useState('synced');
    const dbRef = useRef(null);

    const [attemptId, setAttemptId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [startedAt, setStartedAt] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [questionOrder, setQuestionOrder] = useState([]);

    const attemptIdRef = useRef(null);
    const sessionIdRef = useRef(null);

    useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    useEffect(() => {
        if (attemptId && sessionId) {
            console.log(`Quiz attempt ${attemptId} loaded with session ${sessionId}. Started at: ${startedAt}, expires at: ${expiresAt}. Question count: ${questionOrder.length}`);
        }
    }, [attemptId, sessionId, startedAt, expiresAt, questionOrder]);

    const flagCountRef  = useRef(0);
    const quizStartedRef = useRef(false);
    const answersRef    = useRef({});
    const submittingRef = useRef(false);
    const resultRef     = useRef(null);
    const warningTimer  = useRef(null);
    const isSyncingRef  = useRef(false);
    const studentSocketRef = useRef(null);

    useEffect(() => { answersRef.current    = answers;    }, [answers]);
    useEffect(() => { quizStartedRef.current = quizStarted; }, [quizStarted]);
    useEffect(() => { submittingRef.current  = submitting;  }, [submitting]);
    useEffect(() => { resultRef.current      = result;      }, [result]);
    useEffect(() => { timeLeftRef.current    = timeLeft;    }, [timeLeft]);

    const showWarning = (msg) => {
        clearTimeout(warningTimer.current);
        setWarningMsg(msg);
        warningTimer.current = setTimeout(() => setWarningMsg(''), 5000);
    };

    const reportFlag = useCallback(async (flagType) => {
        try {
            const targetQuizId = quiz?._id || quizCode;
            console.log(`🛡 [Security] Reporting violation: ${flagType} for QuizID: ${targetQuizId}`);
            
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/flag`,
                { quizId: targetQuizId, flagType },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            console.log(`✅ [Security] Flag Recorded. Type: ${flagType}, Total Flags: ${res.data.flagCount}`);
            flagCountRef.current = res.data.flagCount;
            setFlagCount(res.data.flagCount);
            return res.data.flagCount;
        } catch (err) { 
            console.error('❌ [Security] Reporting failed:', err.response?.data?.message || err.message);
            return flagCountRef.current; 
        }
    }, [quizCode, user.token, quiz?._id]);

    /* Load quiz info */
    useEffect(() => {
        axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/info`, { quizId: quizCode }, { headers: { Authorization: `Bearer ${user.token}` } })
            .then(res => {
                setQuiz(res.data.quiz);
                if (res.data.status === 'resuming' && res.data.savedState) {
                    setQuestions(res.data.questions);
                    setAnswers(res.data.savedState.answers || {});
                    setTimeLeft(res.data.savedState.timeRemaining);
                    setAttemptId(res.data.attemptId);
                    setSessionId(res.data.sessionId);
                    setStartedAt(res.data.startedAt);
                    setExpiresAt(res.data.expiresAt);
                    setQuestionOrder(res.data.questionOrder);
                    setIsResuming(true);
                    setQuizStarted(true); // ✅ Activate flag listeners on resume
                } else {
                    setTimeLeft(res.data.quiz.duration * 60);
                }
            })
            .catch(err => { alert(err.response?.data?.message || 'Error loading quiz'); navigate('/'); })
            .finally(() => setLoading(false));
    }, [quizCode, user.token, navigate]);

    /* Timer — single stable interval, not recreated every second */
    useEffect(() => {
        if (!quizStarted || submitting || result) return;
        const t = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(t);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [quizStarted, submitting, result]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Initialize IndexedDB on mount */
    useEffect(() => {
        const init = async () => {
            try {
                const db = await initDB();
                dbRef.current = db;
            } catch (err) {
                console.error('Failed to init IndexedDB', err);
            }
        };
        init();
    }, []);

    /* Synchronization trigger function */
    const triggerSync = useCallback(async () => {
        if (isSyncingRef.current || !dbRef.current || !attemptIdRef.current) return;
        isSyncingRef.current = true;
        setSyncStatus('syncing');

        try {
            const local = await getLocalAnswers(dbRef.current);
            const currentAttemptId = attemptIdRef.current;
            const pendingAnswers = local.filter(item => 
                item.attemptId === currentAttemptId && 
                (item.syncStatus === 'pending' || item.syncStatus === 'failed')
            );

            if (pendingAnswers.length === 0) {
                setSyncStatus('synced');
                isSyncingRef.current = false;
                return;
            }

            // Mark them as syncing locally first
            for (const item of pendingAnswers) {
                item.syncStatus = 'syncing';
                await saveLocalAnswer(dbRef.current, item);
            }

            // Send sync API call (only changed answers/deltas!)
            try {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/attempt/${currentAttemptId}/answers`,
                    { answers: pendingAnswers },
                    { headers: { Authorization: `Bearer ${user.token}` } }
                );

                // Success: mark them as synced in IndexedDB
                for (const item of pendingAnswers) {
                    item.syncStatus = 'synced';
                    await saveLocalAnswer(dbRef.current, item);
                }
                setSyncStatus('synced');
            } catch (err) {
                console.error('Sync request failed, marking answers as failed', err);
                // Failure: mark them as failed in IndexedDB so they will retry
                for (const item of pendingAnswers) {
                    item.syncStatus = 'failed';
                    await saveLocalAnswer(dbRef.current, item);
                }
                setSyncStatus('failed');
            }
        } catch (err) {
            console.error('Error during synchronization:', err);
            setSyncStatus('failed');
        } finally {
            isSyncingRef.current = false;
            // Check if any new pending answers were added while syncing
            if (dbRef.current) {
                const local = await getLocalAnswers(dbRef.current).catch(() => []);
                const hasMorePending = local.some(item => 
                    item.attemptId === attemptIdRef.current && 
                    (item.syncStatus === 'pending' || item.syncStatus === 'failed')
                );
                if (hasMorePending) {
                    setTimeout(triggerSync, 1000);
                }
            }
        }
    }, [user.token]);

    /* Load and merge local IndexedDB answers once DB and attemptId are ready */
    useEffect(() => {
        if (!attemptId || !dbRef.current) return;
        
        const mergeLocal = async () => {
            try {
                const { mergedAnswers, localAnswersToSync } = await syncLocalAnswersWithState(dbRef.current, attemptId, answersRef.current);
                setAnswers(mergedAnswers);
                if (localAnswersToSync.length > 0) {
                    setSyncStatus('pending');
                    triggerSync();
                }
            } catch (err) {
                console.error('Error merging local answers:', err);
            }
        };
        
        mergeLocal();
    }, [attemptId, triggerSync]);

    /* Re-sync when browser detects network is online again */
    useEffect(() => {
        const handleOnline = () => {
            console.log('Browser online: triggering synchronization');
            triggerSync();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [triggerSync]);

    /* Periodic sync interval to catch any failed answers */
    useEffect(() => {
        if (!quizStarted || submitting || result) return;
        const interval = setInterval(() => {
            triggerSync();
        }, 5000);
        return () => clearInterval(interval);
    }, [quizStarted, submitting, result, triggerSync]);

    /* Sync timer and state with server periodically */
    useEffect(() => {
        if (!quizStarted || submitting || result || !attemptId) return;

        const syncState = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/quiz/attempt/${attemptId}/state`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setTimeLeft(res.data.remainingSeconds);
                if (res.data.status === 'EXPIRED') {
                    handleSubmit(true);
                }
            } catch (err) {
                console.error('Error syncing attempt state:', err);
            }
        };

        const syncInterval = setInterval(syncState, 15000);
        return () => clearInterval(syncInterval);
    }, [quizStarted, submitting, result, attemptId, user.token]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Real-time Socket.IO Connection for Students */
    useEffect(() => {
        if (!quizStarted || !attemptId || submitting || result) return;

        const socket = io(import.meta.env.VITE_API_URL, {
            auth: {
                token: user.token
            },
            transports: ['websocket', 'polling']
        });
        studentSocketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ STUDENT SOCKET CONNECTED:', socket.id);
            socket.emit('attempt:join', {
                attemptId,
                quizId: quiz?._id || quizCode
            });
        });

        socket.on('attempt:join_confirmed', (data) => {
            console.log('🛰️ ATTEMPT ROOM LINK VERIFIED:', data.attemptId);
        });

        socket.on('attempt:force-submit', () => {
            console.warn('⚠️ Admin forced submit!');
            handleSubmit(true);
        });

        socket.on('attempt:session-invalid', () => {
            console.warn('⚠️ Session invalid!');
            alert('Your session has been invalidated by the administrator or server.');
            navigate('/');
        });

        socket.on('error', (err) => {
            console.error('⚠️ STUDENT SOCKET ERROR:', err.message);
        });

        return () => {
            if (socket) {
                socket.emit('attempt:leave');
                socket.disconnect();
            }
            studentSocketRef.current = null;
        };
    }, [quizStarted, attemptId, submitting, result, quiz?._id, quizCode, user.token, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Anti-cheat */
    useEffect(() => {
        const onViz = async () => {
            if (document.hidden && quizStartedRef.current && !submittingRef.current && !resultRef.current) {
                const count = await reportFlag('tab_switch');
                if (count >= 3) handleSubmit(true);
                else showWarning(`⚠ Tab switch detected · Flag ${count}/3`);
            }
        };
        const onFS = async () => {
            const inFS = !!document.fullscreenElement;
            setIsFullscreen(inFS);
            if (!inFS && quizStartedRef.current && !submittingRef.current && !resultRef.current) {
                const count = await reportFlag('fullscreen_exit');
                if (count >= 3) handleSubmit(true);
                else showWarning(`⚠ Fullscreen exited · Flag ${count}/3`);
            }
        };
        const onKey = (e) => {
            if (e.ctrlKey && ['c','v','a'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                showWarning('Shortcuts disabled during quiz.');
            }
        };
        document.addEventListener('visibilitychange', onViz);
        document.addEventListener('fullscreenchange', onFS);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('visibilitychange', onViz);
            document.removeEventListener('fullscreenchange', onFS);
            document.removeEventListener('keydown', onKey);
        };
    }, [reportFlag]); // eslint-disable-line react-hooks/exhaustive-deps

    const enterFullscreen = async () => {
        try { await document.documentElement.requestFullscreen(); setIsFullscreen(true); setWarningMsg(''); }
        catch { showWarning('Please allow fullscreen to continue.'); }
    };

    const handleStartQuiz = async () => {
        if (isStarting) return;
        setIsStarting(true);
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
            if (isResuming) {
                setQuizStarted(true);
            } else {
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/start`, { quizId: quiz?._id || quizCode }, { headers: { Authorization: `Bearer ${user.token}` } });
                setQuestions(res.data.questions);
                setTimeLeft(Math.max(0, Math.floor((new Date(res.data.expiresAt).getTime() - new Date(res.data.serverTime).getTime()) / 1000)));
                setAttemptId(res.data.attemptId);
                setSessionId(res.data.sessionId);
                setStartedAt(res.data.startedAt);
                setExpiresAt(res.data.expiresAt);
                setQuestionOrder(res.data.questionOrder);
                setQuizStarted(true);
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message;
            if (errMsg === 'Quiz already started. Please resume.') {
                // Cleanly swallow race conditions or mismatched frontend states by forcing a reload
                window.location.reload();
                return;
            }
            if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
            showWarning(errMsg || 'Fullscreen required. Please try again.');
        } finally {
            setIsStarting(false);
        }
    };

    const handleOptionSelect = async (questionId, option) => {
        // 1. Update UI immediately
        const newAnswers = { ...answers, [questionId]: option };
        setAnswers(newAnswers);

        // 2. Persist to local IndexedDB storage immediately and mark as pending
        if (dbRef.current && attemptIdRef.current) {
            const answerRecord = {
                attemptId: attemptIdRef.current,
                questionId,
                selectedOption: option,
                clientSequence: Date.now(),
                timestamp: new Date().toISOString(),
                syncStatus: 'pending'
            };
            try {
                await saveLocalAnswer(dbRef.current, answerRecord);
                setSyncStatus('pending');
                // Trigger immediate synchronization
                triggerSync();
            } catch (err) {
                console.error('Failed to save answer to IndexedDB', err);
            }
        }
    };

    const handleSubmit = async (force = false) => {
        if (submittingRef.current) return;
        setSubmitting(true);

        // Before submitting: perform a final synchronization of any pending answers!
        if (dbRef.current && attemptIdRef.current) {
            try {
                setSyncStatus('syncing');
                await triggerSync();
                // Check if any answers remain unsynced
                const local = await getLocalAnswers(dbRef.current);
                const currentAttemptId = attemptIdRef.current;
                const unsynced = local.filter(item => 
                    item.attemptId === currentAttemptId && 
                    item.syncStatus !== 'synced'
                );
                if (unsynced.length > 0 && !force) {
                    // Try one more time to sync them
                    await triggerSync();
                }
            } catch (err) {
                console.error('Final sync verification failed', err);
            }
        }

        const cur = force ? answersRef.current : answers;
        const formatted = Object.keys(cur).map(qId => ({ questionId: qId, selectedOption: cur[qId] }));
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/quiz/submit`, {
                quizId: quiz?._id || quizCode,
                attemptId: attemptIdRef.current,
                sessionId: sessionIdRef.current,
                answers: formatted,
                isSuspicious: flagCountRef.current > 0 || force,
                tabSwitches: flagCountRef.current, fullscreenExits: 0,
            }, { headers: { Authorization: `Bearer ${user.token}` } });
            
            // Clean up IndexedDB answers for this attempt upon successful submit
            if (dbRef.current && attemptIdRef.current) {
                await deleteLocalAnswersForAttempt(dbRef.current, attemptIdRef.current).catch(() => {});
            }

            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            setResult(res.data); setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4500);
        } catch { alert('Error submitting quiz.'); }
        finally { setSubmitting(false); }
    };

    const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    const answered = Object.keys(answers).length;
    const progress = questions.length > 0 ? (answered / questions.length) * 100 : 0;
    const LETTERS = ['A','B','C','D','E'];

    /* ── LOADING ── */
    if (loading) return (
        <div style={{ minHeight: '60dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div className="brand-logo" style={{ fontSize: 22 }}>SVHEC</div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading your quiz…</p>
        </div>
    );

    /* ── RESULT ── */
    if (result) return (
        <div style={{ minHeight: '80dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {showConfetti && <Confetti />}
            <div className="card anim-pop" style={{ maxWidth: 460, width: '100%', padding: 'clamp(32px,6vw,52px)', textAlign: 'center' }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', margin: '0 auto 24px', background: 'rgba(48,209,88,0.1)', border: '2px solid rgba(48,209,88,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(48,209,88,0.12)' }}>
                    <svg width="44" height="44" fill="none" stroke="#30d158" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <h2 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>Quiz Submitted! 🎉</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
                    Your answers have been saved. Results will be published by the admin.
                </p>
                {flagCount > 0 && (
                    <div style={{ padding: '10px 16px', marginBottom: 20, borderRadius: 12, background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.25)', color: '#a05800', fontSize: 13 }}>
                        ⚠ {flagCount} flag event{flagCount > 1 ? 's' : ''} recorded during this session.
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-primary btn-full" style={{ padding: 15, fontSize: 16 }} onClick={() => navigate('/my-results')}>View My Results</button>
                    <button className="btn btn-ghost btn-full" onClick={() => navigate('/')}>← Back to Dashboard</button>
                </div>
            </div>
        </div>
    );

    /* ── START SCREEN ── */
    if (!quizStarted) return (
        <div style={{ minHeight: '75dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card anim-up" style={{ maxWidth: 500, width: '100%', padding: 'clamp(28px,6vw,44px)' }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#6c63ff,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', boxShadow: '0 8px 24px rgba(108,99,255,0.28)' }}>
                    <svg width="28" height="28" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                </div>
                <h1 style={{ fontSize: 'clamp(18px,3.5vw,22px)', fontWeight: 700, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 6 }}>{quiz?.title}</h1>
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: 14, marginBottom: 24 }}>
                    {quiz?.duration} minutes · {isResuming ? 'Resuming session' : 'New session'}
                </p>
                {isResuming && (
                    <div style={{ padding: '14px 18px', marginBottom: 18, borderRadius: 14, background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.14)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--brand-accent)', marginBottom: 4, fontSize: 14 }}>🔄 Session Restored</div>
                        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Your previous answers and remaining time have been restored.</p>
                    </div>
                )}
                <div style={{ padding: '14px 18px', marginBottom: 24, borderRadius: 14, background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.18)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#6b4800' }}>Before you begin</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7a5500', lineHeight: 2 }}>
                        <li>Stay in <strong>fullscreen</strong> throughout the quiz</li>
                        <li>Do <strong>not</strong> switch tabs or minimize window</li>
                        <li><strong>3 flags = automatic submission</strong></li>
                        <li>Your activity is monitored in real-time</li>
                        <li>Answers auto-save instantly (offline-ready)</li>
                    </ul>
                </div>
                <button className="btn btn-primary btn-full" style={{ padding: 15, fontSize: 16 }} onClick={handleStartQuiz} disabled={isStarting}>
                    {isStarting ? 'Starting...' : `🖥 Enter Fullscreen & ${isResuming ? 'Resume' : 'Start'} Quiz`}
                </button>
            </div>
        </div>
    );

    /* ── ACTIVE QUIZ ── */
    const curQ = questions[currentQ];

    return (
        <div className="no-select" style={{ maxWidth: 720, margin: '0 auto' }}
            onContextMenu={e => { e.preventDefault(); showWarning('Right-click disabled.'); }}
            onCopy={e => e.preventDefault()} onPaste={e => e.preventDefault()}>

            {/* Fullscreen overlay */}
            {!isFullscreen && !result && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(5,5,20,0.96)', backdropFilter: 'blur(20px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}>
                    <div className="card anim-pop" style={{ maxWidth: 360, width: '100%', padding: '40px 28px', textAlign: 'center' }}>
                        <div style={{ fontSize: 52, marginBottom: 18 }}>🖥</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 10 }}>Quiz Paused</h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>Fullscreen mode is required to continue.</p>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 22, color: flagCount >= 2 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            🚩 Flags: {flagCount}/3 {flagCount >= 2 ? '— One more ends the quiz!' : ''}
                        </p>
                        <button className="btn btn-primary btn-full" style={{ padding: 14 }} onClick={enterFullscreen}>Return to Fullscreen →</button>
                    </div>
                </div>
            )}

            {/* Warning Banner */}
            {warningMsg && isFullscreen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'var(--color-danger)', color: 'white', padding: '12px 20px', textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
                    {warningMsg}
                </div>
            )}

            {/* Sticky Header Bar */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 10, marginBottom: 20,
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
                borderRadius: 18, padding: '12px 18px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
                {/* Progress */}
                <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        <span>{answered}/{questions.length} answered</span>
                        {syncStatus === 'syncing' && <span style={{ color: 'var(--color-warning)' }}>🔄 Syncing...</span>}
                        {syncStatus === 'synced' && <span style={{ color: 'var(--color-success)' }}>✓ Synced</span>}
                        {syncStatus === 'pending' && <span style={{ color: 'var(--color-warning)' }}>⌛ Pending Sync</span>}
                        {syncStatus === 'failed' && <span style={{ color: 'var(--color-danger)' }}>⚠ Sync Failed (Retrying)</span>}
                    </div>
                    <div style={{ height: 4, background: '#eee', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 100, background: 'linear-gradient(90deg,#6c63ff,#a29bfe)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                    </div>
                </div>

                {flagCount > 0 && (
                    <span className={`badge ${flagCount >= 2 ? 'badge-red' : 'badge-yellow'}`}>🚩 {flagCount}/3</span>
                )}

                {/* Timer */}
                <div className={`timer ${timeLeft < 60 ? 'danger' : timeLeft < 300 ? 'warn' : ''}`}>
                    {fmt(timeLeft)}
                </div>
            </div>

            {/* Question Nav Pills (scroll on mobile) */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', marginBottom: 24, overflowX: 'auto', padding: '4px 2px 12px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {questions.map((q, i) => (
                    <button key={q._id} onClick={() => setCurrentQ(i)} style={{
                        minWidth: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        border: i === currentQ ? '2px solid var(--brand-accent)' : '1px solid rgba(0,0,0,0.06)',
                        background: answers[q._id] ? 'linear-gradient(135deg,#6c63ff,#a29bfe)' : i === currentQ ? 'rgba(108,99,255,0.08)' : 'white',
                        color: answers[q._id] ? 'white' : i === currentQ ? 'var(--brand-accent)' : '#666',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: i === currentQ ? '0 8px 16px rgba(108,99,255,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                    }}>
                        {i + 1}
                    </button>
                ))}
            </div>

            {/* Question Card */}
            {curQ ? (
                <div key={currentQ} className="card" style={{ padding: 'clamp(22px,5vw,36px)', marginBottom: 18, animation: 'pageIn 0.28s ease both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <span className="badge badge-purple">Q {currentQ + 1} / {questions.length}</span>
                    </div>
                    <h2 style={{ fontSize: 'clamp(18px, 4.5vw, 24px)', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: curQ.image ? 20 : 32, color: '#111' }}>
                        {curQ.question}
                    </h2>
                    {curQ.image && (
                        <div style={{ 
                            marginBottom: 32, textAlign: 'center', 
                            background: '#f8f9fa', padding: 12, borderRadius: 20, 
                            border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden'
                        }}>
                            <img
                                src={curQ.image}
                                alt="Question"
                                style={{
                                    maxWidth: '100%', width: 'auto', height: 'auto', maxHeight: '50vh', 
                                    borderRadius: 12, display: 'block', margin: '0 auto',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {curQ.options.map((opt, i) => {
                            const sel = answers[curQ._id] === opt;
                            return (
                                <div key={i} className={`q-option${sel ? ' selected' : ''}`} onClick={() => handleOptionSelect(curQ._id, opt)}>
                                    <div className="q-option-letter">{LETTERS[i]}</div>
                                    <span style={{ fontSize: 'clamp(14px,3vw,15px)', fontWeight: sel ? 500 : 400, lineHeight: 1.45, flex: 1 }}>{opt}</span>
                                    {sel && (
                                        <svg style={{ flexShrink: 0 }} width="18" height="18" fill="none" stroke="var(--brand-accent)" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="card anim-up" style={{ padding: '48px 32px', textAlign: 'center', margin: '40px 0' }}>
                    <div style={{ fontSize: 44, marginBottom: 20 }}>📝</div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>No questions found</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 28, fontSize: 15 }}>This quiz doesn't have any questions yet. Please contact the administrator.</p>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>Return to Dashboard</button>
                </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingBottom: 40, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" disabled={currentQ === 0} onClick={() => setCurrentQ(p => Math.max(0, p-1))} style={{ opacity: currentQ === 0 ? 0.4 : 1 }}>
                    ← Previous
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                    {currentQ < questions.length - 1 ? (
                        <button className="btn btn-primary" style={{ padding: '12px 32px', borderRadius: 100 }} onClick={() => setCurrentQ(p => Math.min(questions.length-1, p+1))}>
                            Next Question <ArrowRight size={18} style={{ marginLeft: 4 }} />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSubmit(false)} disabled={submitting}
                            style={{
                                padding: '14px 36px', borderRadius: 100, border: 'none',
                                background: submitting ? '#e2e2ea' : 'linear-gradient(135deg, #111, #333)',
                                color: submitting ? '#a0a0ab' : 'white', 
                                fontWeight: 700, fontSize: 16,
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                boxShadow: submitting ? 'none' : '0 10px 25px rgba(0,0,0,0.15)',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex', alignItems: 'center', gap: 8
                            }}
                            onMouseOver={(e) => { if(!submitting) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseOut={(e) => { if(!submitting) e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            {submitting ? 'Submitting...' : 'Finish & Submit Quiz'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizPage;
