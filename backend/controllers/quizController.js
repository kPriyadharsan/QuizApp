import mongoose from 'mongoose';
import crypto from 'crypto';
import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import QuizState from '../models/QuizState.js';
import Attempt from '../models/Attempt.js';
import { getIO } from '../socket.js';

// --- Data Structures for Caching (Designed for future Redis migration) ---

// 1. Quiz Metadata & Questions Cache
/**
 * quizCache = {
 *   [quizId]: {
 *     quiz: Object,
 *     questions: Array,
 *     duration: number
 *   }
 * }
 */
const quizCache = new Map();

// 2. Active Quiz State Cache
/**
 * activeQuizzes = {
 *   [quizId]: {
 *     users: {
 *       [userId]: {
 *         answers: Object,
 *         timeRemaining: number,
 *         flagCount: number,
 *         flagEvents: Array,
 *         startedAt: Date,
 *         lastSavedAt: Date
 *       }
 *     }
 *   }
 * }
 */
const activeQuizzes = new Map();

// --- 3. Backend Request Queue for MongoDB Writes ---
const saveQueue = new Map(); // key: `${userId}:${quizId}`, value: { answers: {}, timeRemaining: number }

const flushQueue = async () => {
    if (saveQueue.size === 0) return;

    const entries = [...saveQueue.entries()];
    saveQueue.clear();

    const bulkOps = entries.map(([key, data]) => {
        const [userId, quizId] = key.split(':');
        const setPayload = {};
        for (const [qId, ans] of Object.entries(data.answers)) {
            setPayload[`answers.${qId}`] = ans;
        }
        return {
            updateOne: {
                filter: { userId, quizId },
                update: { 
                    $set: { 
                        ...setPayload, 
                        timeRemaining: data.timeRemaining,
                        lastSavedAt: new Date() 
                    } 
                },
                upsert: true
            }
        };
    });

    try {
        await QuizState.bulkWrite(bulkOps, { ordered: false });
        console.log(`[Queue] Flushed ${bulkOps.length} saves to MongoDB`);
    } catch (err) {
        console.error('[Queue] Error flushing to DB:', err);
    }
};

setInterval(flushQueue, 3000); // Drain every 3 seconds

// --- Cache Helpers ---

export const invalidateQuizCache = (quizIdStr) => {
    if (quizIdStr && quizCache.has(quizIdStr.toString())) {
        quizCache.delete(quizIdStr.toString());
        console.log(`🧹 Cache cleared for quiz: ${quizIdStr}`);
    }
};

// Resolves and caches quiz metadata and questions to prevent repeated DB reads
const resolveQuiz = async (idOrCode) => {
    if (!idOrCode) return null;
    
    const quizCodeRegexString = idOrCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // First check memory cache
    for (const [quizId, cachedData] of quizCache.entries()) {
        if (cachedData.quiz.quizCode.toLowerCase() === idOrCode.toLowerCase() || quizId.toString() === idOrCode.toString()) {
            return cachedData.quiz;
        }
    }

    let quiz = null;
    if (mongoose.Types.ObjectId.isValid(idOrCode)) {
        quiz = await Quiz.findById(idOrCode).lean();
    } else {
        quiz = await Quiz.findOne({ 
            quizCode: { $regex: new RegExp(`^${quizCodeRegexString}$`, 'i') } 
        }).lean();
    }

    if (quiz) {
        // Cache this quiz heavily
        const questions = await Question.find({ quizId: quiz._id }).lean();
        quizCache.set(quiz._id.toString(), {
            quiz,
            questions,
            duration: quiz.duration
        });

        // Initialize user state container for this quiz if it doesn't exist
        if (!activeQuizzes.has(quiz._id.toString())) {
            activeQuizzes.set(quiz._id.toString(), { users: new Map() });
        }
        
        return quiz;
    }

    return null;
};

// Gets user state from memory or fallback briefly to database if they were mid-session from earlier version.
const getUserState = async (quizIdStr, userIdStr) => {
    if (!activeQuizzes.has(quizIdStr)) {
        activeQuizzes.set(quizIdStr, { users: new Map() });
    }
    const quizUsers = activeQuizzes.get(quizIdStr).users;
    
    let userState = quizUsers.get(userIdStr);
    
    if (!userState) {
        // Fallback for mid-flight restarts. Can be removed later.
        const dbState = await QuizState.findOne({ userId: userIdStr, quizId: quizIdStr }).lean();
        if (dbState) {
            userState = {
                answers: dbState.answers ? Object.fromEntries(Object.entries(dbState.answers)) : {},
                timeRemaining: dbState.timeRemaining,
                flagCount: dbState.flagCount || 0,
                flagEvents: dbState.flagEvents || [],
                startedAt: dbState.startedAt,
                lastSavedAt: dbState.lastSavedAt
            };
            quizUsers.set(userIdStr, userState);
        }
    }
    
    return userState;
};

// --- Controller Functions ---

export const getActiveQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isActive: true }).lean();
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
    }
};

export const getPublishedLeaderboards = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ leaderboardPublished: true }).select('title _id').lean();
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching published leaderboards', error: error.message });
    }
};

export const verifyQuizCode = async (req, res) => {
    try {
        const { quizCode } = req.body;
        if (!quizCode) return res.status(400).json({ message: 'Quiz code is required' });

        const quiz = await resolveQuiz(quizCode);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Invalid Quiz Code or quiz is no longer active.' });
        }

        res.json({ quizId: quiz._id });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying quiz code', error: error.message });
    }
};

export const getQuizInfo = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);

        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // Check if user already submitted
        const existingSubmission = await Submission.exists({ userId: req.user.id, quizId: quiz._id });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Locate existing Attempt or migrate legacy QuizState if necessary
        let attempt = await Attempt.findOne({ userId: req.user.id, quizId: quiz._id });
        if (!attempt) {
            // Migration check: check if legacy QuizState exists
            const dbState = await QuizState.findOne({ userId: req.user.id, quizId: quiz._id }).lean();
            if (dbState) {
                const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
                const now = new Date();
                const startedAt = dbState.startedAt ? new Date(dbState.startedAt) : now;
                const durationMs = quiz.duration * 60 * 1000;
                const expiresAt = new Date(startedAt.getTime() + durationMs);

                const cachedQuestions = quizCache.get(actualQuizIdStr).questions;
                const questionOrder = cachedQuestions.map(q => ({
                    questionId: q._id,
                    options: q.options
                }));

                const answersMap = new Map();
                if (dbState.answers) {
                    for (const [qId, ans] of Object.entries(dbState.answers)) {
                        answersMap.set(qId, ans);
                    }
                }

                attempt = await Attempt.create({
                    userId: req.user.id,
                    quizId: quiz._id,
                    sessionId,
                    status: 'IN_PROGRESS',
                    startedAt,
                    expiresAt,
                    lastSeenAt: now,
                    questionOrder,
                    answers: answersMap,
                    answeredCount: answersMap.size,
                    connectionStatus: 'CONNECTED',
                    flagCount: dbState.flagCount || 0,
                    flagEvents: dbState.flagEvents || []
                });
                console.log(`📡 [Migration] Migrated legacy QuizState to Attempt for user ${userIdStr}`);
            }
        }

        if (attempt) {
            if (attempt.status === 'SUBMITTED') {
                return res.status(400).json({ message: 'You have already submitted this quiz' });
            }
            if (attempt.status === 'EXPIRED' || attempt.status === 'ABANDONED') {
                return res.status(400).json({ message: 'Your attempt has ended.' });
            }

            // Calculate remaining time relative to server-controlled expiresAt
            const nowMs = Date.now();
            const expiresAtMs = new Date(attempt.expiresAt).getTime();
            let timeRemaining = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

            // Time expired
            if (timeRemaining <= 0) {
                attempt.status = 'EXPIRED';
                attempt.submittedAt = new Date();
                await attempt.save();

                let score = 0;
                const questionsList = quizCache.get(actualQuizIdStr).questions;
                const answersObj = attempt.answers ? Object.fromEntries(attempt.answers) : {};

                const evaluatedAnswers = Object.keys(answersObj).map(qId => {
                    const question = questionsList.find(q => q._id.toString() === qId);
                    const isCorrect = question && question.correctAnswer === answersObj[qId];
                    if (isCorrect) score += 1;
                    return { questionId: qId, selectedOption: answersObj[qId], isCorrect };
                });

                await Submission.create({
                    userId: req.user.id,
                    quizId: quiz._id,
                    answers: evaluatedAnswers,
                    score,
                    isSuspicious: true,
                    tabSwitches: attempt.flagCount || 0,
                    fullscreenExits: 0
                });

                // Clear from memory cache & legacy QuizState
                activeQuizzes.get(actualQuizIdStr)?.users.delete(userIdStr);
                await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });
                
                return res.status(403).json({ message: 'Your quiz time has expired. It has been automatically submitted.' });
            }

            // User is resuming: reconstruct questions in the exact same question/option order
            const cachedQuestions = quizCache.get(actualQuizIdStr).questions;
            let questions = [];
            for (const qOrder of attempt.questionOrder) {
                const matchedQ = cachedQuestions.find(q => q._id.toString() === qOrder.questionId.toString());
                if (matchedQ) {
                    const questionClone = JSON.parse(JSON.stringify(matchedQ));
                    delete questionClone.correctAnswer;
                    questionClone.options = qOrder.options;
                    questions.push(questionClone);
                }
            }

            // Sync legacy activeQuizzes memory cache
            let userState = await getUserState(actualQuizIdStr, userIdStr);
            if (!userState) {
                userState = {
                    answers: attempt.answers ? Object.fromEntries(attempt.answers) : {},
                    timeRemaining,
                    flagCount: attempt.flagCount || 0,
                    flagEvents: attempt.flagEvents || [],
                    startedAt: attempt.startedAt,
                    lastSavedAt: attempt.updatedAt || new Date()
                };
                activeQuizzes.get(actualQuizIdStr).users.set(userIdStr, userState);
            }
            
            return res.json({
                attemptId: attempt._id,
                sessionId: attempt.sessionId,
                quiz,
                questions,
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt,
                questionOrder: attempt.questionOrder,
                savedState: {
                    answers: attempt.answers ? Object.fromEntries(attempt.answers) : {},
                    timeRemaining
                },
                status: 'resuming'
            });
        }

        // Fresh quiz
        return res.json({
            quiz,
            questions: [],
            savedState: null,
            status: 'new'
        });
    } catch (error) {
        console.error('Error in getQuizInfo:', error);
        res.status(500).json({ message: 'Error fetching quiz info', error: error.message });
    }
};

export const startQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await resolveQuiz(quizId);
        
        if (!quiz || !quiz.isActive) {
            return res.status(404).json({ message: 'Quiz not found or not active' });
        }
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // Verify eligibility: Check if user is blocked
        const user = await User.findById(req.user.id);
        if (!user || user.isBlocked) {
            return res.status(403).json({ message: 'You are not eligible to take this quiz.' });
        }

        // Check if user already submitted
        const existingSubmission = await Submission.exists({ userId: req.user.id, quizId: quiz._id });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Check if Attempt already exists
        let existingAttempt = await Attempt.findOne({ userId: req.user.id, quizId: quiz._id });
        if (existingAttempt) {
            if (existingAttempt.status === 'IN_PROGRESS' || existingAttempt.status === 'CREATED') {
                return res.status(400).json({ message: 'Quiz already started. Please resume.' });
            } else {
                return res.status(400).json({ message: 'You have already attempted this quiz.' });
            }
        }

        // Verify start time
        if (quiz.startTime) {
            const nowMs = Date.now();
            const startTimeMs = new Date(quiz.startTime).getTime();
            if (nowMs < startTimeMs) {
                return res.status(403).json({ message: 'This quiz has not started yet.' });
            }
        }

        // Scramble questions and option order (do not alter cache directly)
        const cachedQuestions = quizCache.get(actualQuizIdStr).questions;
        let shuffledQuestions = JSON.parse(JSON.stringify(cachedQuestions));

        // Shuffle questions
        for (let i = shuffledQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
        }

        // Shuffle options for each question
        const questionOrder = shuffledQuestions.map(q => {
            let options = [...q.options];
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }
            return {
                questionId: q._id,
                options
            };
        });

        // Set times
        const now = new Date();
        const durationMs = quiz.duration * 60 * 1000;
        const expiresAt = new Date(now.getTime() + durationMs);

        // Generate secure sessionId
        const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        // Create the Attempt atomically and durably in MongoDB
        const attempt = await Attempt.create({
            userId: req.user.id,
            quizId: quiz._id,
            sessionId,
            status: 'IN_PROGRESS',
            startedAt: now,
            expiresAt,
            lastSeenAt: now,
            currentQuestionIndex: 0,
            questionOrder,
            answers: {},
            answeredCount: 0,
            connectionStatus: 'CONNECTED',
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
            userAgent: req.headers['user-agent'] || '',
            flagCount: 0,
            flagEvents: []
        });

        // Write compatible QuizState record to DB
        await QuizState.create({
            userId: req.user.id,
            quizId: quiz._id,
            answers: {},
            startedAt: now,
            timeRemaining: quiz.duration * 60,
            lastSavedAt: now,
            flagCount: 0,
            flagEvents: []
        });

        // Initialize activeQuizzes RAM cache
        activeQuizzes.get(actualQuizIdStr).users.set(userIdStr, {
            answers: {},
            startedAt: now,
            timeRemaining: quiz.duration * 60,
            lastSavedAt: now,
            flagCount: 0,
            flagEvents: []
        });

        // Map questions to return to frontend (without correct answers, option order matching questionOrder)
        const frontendQuestions = shuffledQuestions.map(q => {
            const mappedQ = { ...q };
            delete mappedQ.correctAnswer;
            const matchOrder = questionOrder.find(qo => qo.questionId.toString() === q._id.toString());
            if (matchOrder) {
                mappedQ.options = matchOrder.options;
            }
            return mappedQ;
        });

        console.log(`🚀 [Quiz] User ${userIdStr} naturally started Quiz: ${actualQuizIdStr} | Attempt ID: ${attempt._id}`);
        res.json({
            attemptId: attempt._id,
            sessionId,
            quiz,
            questions: frontendQuestions,
            serverTime: now,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            questionOrder
        });
    } catch (error) {
        console.error('Error in startQuiz:', error);
        res.status(500).json({ message: 'Error starting quiz', error: error.message });
    }
};

export const saveQuizState = async (req, res) => {
    try {
        const { quizId, attemptId, sessionId, answers, timeRemaining } = req.body;
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        // 1. Locate Attempt and verify session
        let attempt = null;
        if (attemptId) {
            attempt = await Attempt.findById(attemptId);
        } else {
            attempt = await Attempt.findOne({ userId: req.user.id, quizId: quiz._id, status: 'IN_PROGRESS' });
        }

        if (!attempt) {
            return res.status(404).json({ message: 'Active attempt not found' });
        }

        if (sessionId && attempt.sessionId !== sessionId) {
            return res.status(403).json({ message: 'Invalid session ID for this attempt' });
        }

        if (attempt.status !== 'IN_PROGRESS') {
            return res.status(400).json({ message: `Attempt is already ${attempt.status.toLowerCase()}` });
        }

        // Verify expiration server-side
        const nowMs = Date.now();
        const expiresAtMs = new Date(attempt.expiresAt).getTime();
        if (nowMs > expiresAtMs) {
            attempt.status = 'EXPIRED';
            attempt.submittedAt = new Date();
            await attempt.save();

            const questionsList = quizCache.get(actualQuizIdStr).questions;
            const answersObj = attempt.answers ? Object.fromEntries(attempt.answers) : {};
            let score = 0;
            const evaluatedAnswers = Object.keys(answersObj).map(qId => {
                const question = questionsList.find(q => q._id.toString() === qId);
                const isCorrect = question && question.correctAnswer === answersObj[qId];
                if (isCorrect) score += 1;
                return { questionId: qId, selectedOption: answersObj[qId], isCorrect };
            });

            await Submission.create({
                userId: req.user.id,
                quizId: quiz._id,
                answers: evaluatedAnswers,
                score,
                isSuspicious: true,
                tabSwitches: attempt.flagCount || 0,
                fullscreenExits: 0
            });

            // Clear from memory cache & legacy QuizState
            activeQuizzes.get(actualQuizIdStr)?.users.delete(userIdStr);
            await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });

            return res.status(403).json({ message: 'Your quiz time has expired. It has been automatically submitted.' });
        }

        // 2. Update In-Memory Cache
        let calculatedTimeRemaining = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
        let userState = await getUserState(actualQuizIdStr, userIdStr);
        if (userState) {
            userState.answers = { ...userState.answers, ...answers }; // Merge partial answers
            userState.timeRemaining = calculatedTimeRemaining;
            userState.lastSavedAt = new Date();
        } else {
            userState = {
                answers,
                timeRemaining: calculatedTimeRemaining,
                lastSavedAt: new Date(),
                startedAt: attempt.startedAt,
                flagCount: attempt.flagCount || 0,
                flagEvents: attempt.flagEvents || []
            };
            activeQuizzes.get(actualQuizIdStr).users.set(userIdStr, userState);
        }

        // 3. Update Attempt in DB
        if (answers) {
            for (const [qId, ans] of Object.entries(answers)) {
                attempt.answers.set(qId, ans);
            }
            attempt.answeredCount = attempt.answers.size;
        }
        attempt.lastSeenAt = new Date();
        attempt.connectionStatus = 'CONNECTED';
        await attempt.save();

        // 4. Update compatible QuizState model (via write queue)
        if (answers && Object.keys(answers).length > 0) {
            const queueKey = `${userIdStr}:${actualQuizIdStr}`;
            const existing = saveQueue.get(queueKey) || { answers: {}, timeRemaining: calculatedTimeRemaining };
            saveQueue.set(queueKey, {
                answers: { ...existing.answers, ...answers },
                timeRemaining: calculatedTimeRemaining
            });
        }

        res.status(200).json({ success: true, message: 'Quiz state saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving quiz state', error: error.message });
    }
};

export const submitQuiz = async (req, res) => {
    try {
        const { quizId, attemptId, sessionId, answers, isSuspicious, tabSwitches, fullscreenExits } = req.body; 
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        
        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();

        const questions = quizCache.get(actualQuizIdStr).questions;

        // 1. Locate existing submission first to make this idempotent
        const existingSub = await Submission.findOne({ userId: req.user.id, quizId: quiz._id });
        if (existingSub) {
            return res.status(200).json({ 
                message: 'Quiz submitted successfully. Results will be published later.', 
                total: questions.length, 
                submission: existingSub 
            });
        }

        // 2. Find Attempt
        let attempt = null;
        if (attemptId) {
            attempt = await Attempt.findById(attemptId);
        } else {
            attempt = await Attempt.findOne({ userId: req.user.id, quizId: quiz._id });
        }

        if (!attempt) {
            return res.status(404).json({ message: 'Active attempt not found' });
        }

        if (sessionId && attempt.sessionId !== sessionId) {
            return res.status(403).json({ message: 'Invalid session ID for this attempt' });
        }

        // Check if already finalized (to prevent double submissions)
        if (attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED') {
            const finalSub = await Submission.findOne({ userId: req.user.id, quizId: quiz._id });
            if (finalSub) {
                return res.status(200).json({ 
                    message: 'Quiz submitted successfully. Results will be published later.', 
                    total: questions.length, 
                    submission: finalSub 
                });
            }
            return res.status(400).json({ message: 'This attempt has already been finalized.' });
        }

        // 3. Map answers array to object format if answers is an array (which frontend sends)
        const answersMap = new Map();
        if (Array.isArray(answers)) {
            answers.forEach(ans => {
                answersMap.set(ans.questionId, ans.selectedOption);
            });
        } else if (answers && typeof answers === 'object') {
            Object.entries(answers).forEach(([qId, val]) => {
                answersMap.set(qId, val);
            });
        }

        // 4. Final Server-Side Expiration Check
        const now = new Date();
        const expiresAtMs = new Date(attempt.expiresAt).getTime();
        const isExpired = now.getTime() > expiresAtMs;

        // Atomically transition the attempt state using findOneAndUpdate to guarantee only one request can process the finalization
        const targetStatus = isExpired ? 'EXPIRED' : 'SUBMITTED';
        
        // Merge final answers into attempt update payload
        const setPayload = {
            status: targetStatus,
            submittedAt: now,
            flagCount: tabSwitches || attempt.flagCount || 0,
            answeredCount: answersMap.size
        };
        for (const [qId, ans] of answersMap.entries()) {
            setPayload[`answers.${qId}`] = ans;
        }

        const updatedAttempt = await Attempt.findOneAndUpdate(
            { _id: attempt._id, status: 'IN_PROGRESS' },
            { $set: setPayload },
            { new: true }
        );

        if (!updatedAttempt) {
            // A concurrent request won the race and updated status!
            // Retrieve already finalized submission
            const finalSub = await Submission.findOne({ userId: req.user.id, quizId: quiz._id });
            if (finalSub) {
                return res.status(200).json({ 
                    message: 'Quiz submitted successfully. Results will be published later.', 
                    total: questions.length, 
                    submission: finalSub 
                });
            }
            return res.status(400).json({ message: 'Attempt has already been finalized.' });
        }

        // 5. Evaluate score and create Submission
        const previousSubmissionsCount = await Submission.countDocuments({ userId: req.user.id, quizId: quiz._id });

        let score = 0;
        const evaluatedAnswers = Array.from(answersMap.entries()).map(([qId, selectedOption]) => {
            const question = questions.find(q => q._id.toString() === qId);
            const isCorrect = question && question.correctAnswer === selectedOption;
            if (isCorrect) score += 1;

            return {
                questionId: qId,
                selectedOption,
                isCorrect
            };
        });

        let submission;
        try {
            submission = await Submission.create({
                userId: req.user.id,
                quizId: quiz._id,
                answers: evaluatedAnswers,
                score,
                isSuspicious: isSuspicious || isExpired || false,
                tabSwitches: tabSwitches || 0,
                fullscreenExits: 0,
                attemptNumber: previousSubmissionsCount + 1
            });
        } catch (err) {
            if (err.code === 11000) {
                // Catch unique index collision and return existing submission (extremely safe/idempotent)
                const finalSub = await Submission.findOne({ userId: req.user.id, quizId: quiz._id });
                return res.status(200).json({ 
                    message: 'Quiz submitted successfully. Results will be published later.', 
                    total: questions.length, 
                    submission: finalSub 
                });
            }
            throw err;
        }

        // Delete from RAM cache and compatible QuizState record
        if (activeQuizzes.has(actualQuizIdStr)) {
            activeQuizzes.get(actualQuizIdStr).users.delete(userIdStr);
        }
        await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });

        console.log(`✅ [Quiz] User ${userIdStr} submitted Quiz: ${actualQuizIdStr} | Score: ${score}/${questions.length} | Status: ${targetStatus}`);
        res.status(201).json({ message: 'Quiz submitted successfully. Results will be published later.', total: questions.length, submission });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting quiz', error: error.message });
    }
};

export const getLeaderboard = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await resolveQuiz(quizId);
        
        if (!quiz || !quiz.leaderboardPublished) {
            return res.status(403).json({ message: 'Leaderboard is not published for this quiz yet.' });
        }

        // Optimized Leaderboard query using MongoDB Aggregation
        const leaderboard = await Submission.aggregate([
            { $match: { quizId: quiz._id } },
            // Sort by score first to ensure $first takes the best score per user
            { $sort: { score: -1, submittedAt: 1 } },
            { $group: {
                _id: "$userId",
                bestScore: { $first: "$score" }
            }},
            // Lookup user details
            { $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }},
            { $unwind: "$user" },
            { $match: { "user.role": "user" } },
            { $project: {
                _id: 1,
                name: "$user.name",
                score: "$bestScore"
            }},
            { $sort: { score: -1 } },
            { $limit: 10 }
        ]);

        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
    }
};

export const getMyResults = async (req, res) => {
    try {
        const submissions = await Submission.find({ userId: req.user.id })
            .populate('quizId', 'title resultsPublished').lean();

        const publishedSubmissions = submissions.filter(s => s.quizId && s.quizId.resultsPublished);

        // Fetch question counts using the cache
        for (let sub of publishedSubmissions) {
            const actualQuizIdStr = sub.quizId._id.toString();
            // Load into cache if not present (to get question counts)
            await resolveQuiz(actualQuizIdStr);
            const cacheHit = quizCache.get(actualQuizIdStr);
            sub.totalQuestions = cacheHit ? cacheHit.questions.length : 0;
        }

        res.json(publishedSubmissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your results', error: error.message });
    }
};

export const reportFlag = async (req, res) => {
    try {
        const { quizId, flagType } = req.body;
        const userIdStr = req.user.id.toString();
        
        const quiz = await resolveQuiz(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        const actualQuizIdStr = quiz._id.toString();

        const validTypes = ['tab_switch', 'fullscreen_exit', 'page_blur', 'refresh'];
        if (!validTypes.includes(flagType)) {
            return res.status(400).json({ message: 'Invalid flag type' });
        }

        // Find Attempt
        let attempt = await Attempt.findOne({ userId: req.user.id, quizId: quiz._id, status: 'IN_PROGRESS' });
        if (!attempt) {
            return res.status(404).json({ message: 'Active attempt not found' });
        }

        attempt.flagCount = (attempt.flagCount || 0) + 1;
        if (!attempt.flagEvents) attempt.flagEvents = [];
        attempt.flagEvents.push({ type: flagType, timestamp: new Date() });
        await attempt.save();

        // Also update memory cache
        let userState = await getUserState(actualQuizIdStr, userIdStr);
        if (userState) {
            userState.flagCount = attempt.flagCount;
            userState.flagEvents = attempt.flagEvents;
        }

        // Update compatible QuizState model
        await QuizState.findOneAndUpdate(
            { userId: req.user.id, quizId: quiz._id },
            { 
                $inc: { flagCount: 1 }, 
                $push: { flagEvents: { type: flagType, timestamp: new Date() } } 
            }
        );

        // Get user details for the real-time broadcast (DB read ONLY for Admin, others hit cache optionally or just run DB once)
        let user = null;
        if (userIdStr !== 'admin-id') {
            user = await User.findById(req.user.id).select('name email').lean();
        } else {
            user = { name: 'System Admin', email: 'dharsan@admin.com' };
        }

        // Emit real-time flag event to admin via Socket.IO
        const io = getIO();
        if (io) {
            const roomName = `admin:${actualQuizIdStr}`;
            const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
            console.log(`📡 BROADCASTING Flag Update: [Room: ${roomName}] [Viewers: ${roomSize}] [User: ${user?.name}] [Flag: ${flagType}]`);
            
            io.to(roomName).emit('flag:update', {
                userId: userIdStr,
                userName: user?.name || 'Unknown',
                userEmail: user?.email || '',
                quizId: actualQuizIdStr,
                flagType,
                flagCount: attempt.flagCount,
                flagEvents: attempt.flagEvents,
                timestamp: new Date()
            });
        }

        res.json({ flagCount: attempt.flagCount });
    } catch (error) {
        res.status(500).json({ message: 'Error reporting flag', error: error.message });
    }
};

export const getAttemptState = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Unauthorized access to this attempt' });
        }

        const quiz = await resolveQuiz(attempt.quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = req.user.id.toString();
        
        const now = new Date();
        const expiresAtMs = new Date(attempt.expiresAt).getTime();
        const nowMs = now.getTime();
        let remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

        // If expired and still in progress, auto-finalize safely
        if (remainingSeconds <= 0 && attempt.status === 'IN_PROGRESS') {
            attempt.status = 'EXPIRED';
            attempt.submittedAt = now;
            await attempt.save();

            // Auto-submit: create a Submission atomically if it doesn't exist
            const previousSubmission = await Submission.findOne({ userId: req.user.id, quizId: quiz._id });
            if (!previousSubmission) {
                const questionsList = quizCache.get(actualQuizIdStr).questions;
                const answersObj = attempt.answers ? Object.fromEntries(attempt.answers) : {};
                let score = 0;
                const evaluatedAnswers = Object.keys(answersObj).map(qId => {
                    const question = questionsList.find(q => q._id.toString() === qId);
                    const isCorrect = question && question.correctAnswer === answersObj[qId];
                    if (isCorrect) score += 1;
                    return { questionId: qId, selectedOption: answersObj[qId], isCorrect };
                });

                await Submission.create({
                    userId: req.user.id,
                    quizId: quiz._id,
                    answers: evaluatedAnswers,
                    score,
                    isSuspicious: true,
                    tabSwitches: attempt.flagCount || 0,
                    fullscreenExits: 0
                });
            }

            // Clean memory cache & compatible QuizState
            activeQuizzes.get(actualQuizIdStr)?.users.delete(userIdStr);
            await QuizState.findOneAndDelete({ userId: req.user.id, quizId: quiz._id });
            
            remainingSeconds = 0;
        }

        res.json({
            status: attempt.status,
            serverTime: now,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            remainingSeconds,
            questionOrder: attempt.questionOrder,
            answers: attempt.answers ? Object.fromEntries(attempt.answers) : {},
            currentQuestionIndex: attempt.currentQuestionIndex,
            answeredCount: attempt.answeredCount,
            connectionStatus: attempt.connectionStatus,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent
        });
    } catch (error) {
        console.error('Error in getAttemptState:', error);
        res.status(500).json({ message: 'Error fetching attempt state', error: error.message });
    }
};
