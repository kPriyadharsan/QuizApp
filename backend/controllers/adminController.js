import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import QuizState from '../models/QuizState.js';
import Attempt from '../models/Attempt.js';
import AppSettings from '../models/AppSettings.js';
import { invalidateQuizCache, activeQuizzes, evaluateAttemptScore } from './quizController.js';
import { getIO } from '../socket.js';

const isQuizLocked = (quiz) => {
    if (!quiz) return false;
    return quiz.status === 'LIVE' || quiz.status === 'COMPLETED' || new Date().getTime() >= new Date(quiz.startTime).getTime();
};

// Helper to get or create settings
const getSettings = async () => {
    let settings = await AppSettings.findOne();
    if (!settings) {
        settings = await AppSettings.create({ registrationOpen: true });
    }
    return settings;
};

export const createQuiz = async (req, res) => {
    try {
        const { title, quizCode, duration, startTime, liveMonitoringEnabled } = req.body;
        const quiz = await Quiz.create({
            title,
            quizCode: quizCode.toUpperCase(),
            duration,
            startTime,
            liveMonitoringEnabled: !!liveMonitoringEnabled
        });
        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quiz', error: error.message });
    }
};

export const addQuestion = async (req, res) => {
    try {
        const { quizId, question, options, correctAnswer, image, explanation, explanationImage } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (isQuizLocked(quiz)) {
            return res.status(400).json({ message: 'Settings locked: Cannot add questions after the quiz has started.' });
        }

        const newQuestion = await Question.create({
            quizId,
            question,
            options,
            correctAnswer,
            image,
            explanation,
            explanationImage
        });

        invalidateQuizCache(quizId);
        res.status(201).json(newQuestion);
    } catch (error) {
        res.status(500).json({ message: 'Error adding question', error: error.message });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const { quizId } = req.params;
        const questions = await Question.find({ quizId });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching questions', error: error.message });
    }
};

export const updateQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { question, options, correctAnswer, image, explanation, explanationImage } = req.body;
        
        const existingQuestion = await Question.findById(questionId);
        if (!existingQuestion) return res.status(404).json({ message: 'Question not found' });

        const quiz = await Quiz.findById(existingQuestion.quizId);
        if (quiz && isQuizLocked(quiz)) {
            return res.status(400).json({ message: 'Settings locked: Cannot update questions after the quiz has started.' });
        }

        const updatedQuestion = await Question.findByIdAndUpdate(
            questionId,
            { question, options, correctAnswer, image, explanation, explanationImage },
            { new: true, runValidators: true }
        );
        
        invalidateQuizCache(updatedQuestion.quizId);
        res.json(updatedQuestion);
    } catch (error) {
        res.status(500).json({ message: 'Error updating question', error: error.message });
    }
};

export const deleteQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;

        const existingQuestion = await Question.findById(questionId);
        if (!existingQuestion) return res.status(404).json({ message: 'Question not found' });

        const quiz = await Quiz.findById(existingQuestion.quizId);
        if (quiz && isQuizLocked(quiz)) {
            return res.status(400).json({ message: 'Settings locked: Cannot delete questions after the quiz has started.' });
        }

        await Question.findByIdAndDelete(questionId);
        
        invalidateQuizCache(existingQuestion.quizId);
        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question', error: error.message });
    }
};

// Get ALL quizzes (for admin - includes stopped quizzes)
export const getAllQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({}).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
    }
};

export const stopQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.isActive = false;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: 'Quiz stopped successfully', quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error stopping quiz', error: error.message });
    }
};

export const deleteQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Delete all questions, submissions, and attempts for this quiz
        await Question.deleteMany({ quizId });
        await Submission.deleteMany({ quizId });
        await Attempt.deleteMany({ quizId });
        await Quiz.findByIdAndDelete(quizId);

        invalidateQuizCache(quizId);
        res.json({ message: 'Quiz and all related data deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting quiz', error: error.message });
    }
};

export const getResults = async (req, res) => {
    try {
        const submissions = await Submission.find({})
            .populate('userId', 'name email score')
            .populate('quizId', 'title')
            .sort({ score: -1 });

        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching results', error: error.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

export const toggleResults = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.resultsPublished = !quiz.resultsPublished;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: `Results ${quiz.resultsPublished ? 'published' : 'hidden'} successfully`, quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling results', error: error.message });
    }
};

export const toggleLeaderboard = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.leaderboardPublished = !quiz.leaderboardPublished;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: `Leaderboard ${quiz.leaderboardPublished ? 'published' : 'hidden'} successfully`, quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling leaderboard', error: error.message });
    }
};

export const blockUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isBlocked = true;
        await user.save();
        res.json({ message: 'User blocked successfully', user: { _id: user._id, name: user.name, email: user.email, isBlocked: user.isBlocked } });
    } catch (error) {
        res.status(500).json({ message: 'Error blocking user', error: error.message });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isBlocked = false;
        await user.save();
        res.json({ message: 'User unblocked successfully', user: { _id: user._id, name: user.name, email: user.email, isBlocked: user.isBlocked } });
    } catch (error) {
        res.status(500).json({ message: 'Error unblocking user', error: error.message });
    }
};

export const getLiveAttendees = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        // Get submitted users
        const submissions = await Submission.find({ quizId })
            .populate('userId', 'name email isBlocked');

        const submitted = submissions.map(s => ({
            _id: s.userId?._id,
            name: s.userId?.name,
            email: s.userId?.email,
            isBlocked: s.userId?.isBlocked,
            score: s.score,
            isSuspicious: s.isSuspicious,
            tabSwitches: s.tabSwitches,
            fullscreenExits: s.fullscreenExits,
            submittedAt: s.submittedAt,
            status: 'submitted',
            flagCount: s.tabSwitches + s.fullscreenExits
        }));

        let active = [];
        const totalUsers = await User.countDocuments({ role: 'user' });

        if (quiz.liveMonitoringEnabled) {
            // Get currently active quiz takers
            const activeStates = await Attempt.find({ quizId, status: { $in: ['IN_PROGRESS', 'EXPIRED'] } })
                .populate('userId', 'name email isBlocked');

            active = activeStates.map(s => {
                const expiresAtMs = new Date(s.expiresAt).getTime();
                const nowMs = Date.now();
                const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

                return {
                    _id: s.userId?._id,
                    name: s.userId?.name,
                    email: s.userId?.email,
                    isBlocked: s.userId?.isBlocked,
                    score: null,
                    isSuspicious: s.flagCount > 0,
                    status: s.status === 'EXPIRED' ? 'expired' : 'in_progress',
                    connectionStatus: s.connectionStatus,
                    currentQuestionIndex: s.currentQuestionIndex || 0,
                    answeredCount: s.answeredCount || 0,
                    remainingSeconds,
                    startedAt: s.startedAt,
                    lastSeenAt: s.lastSeenAt,
                    flagCount: s.flagCount || 0,
                    flagEvents: s.flagEvents || [],
                    attemptId: s._id
                };
            });
        }

        res.json({
            liveMonitoringEnabled: quiz.liveMonitoringEnabled,
            attendees: [...active, ...submitted],
            totalUsers,
            attendeeCount: active.length + submitted.length,
            activeCount: active.length,
            submittedCount: submitted.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendees', error: error.message });
    }
};

// Toggle registration open/closed
export const toggleRegistration = async (req, res) => {
    try {
        const settings = await getSettings();
        settings.registrationOpen = !settings.registrationOpen;
        await settings.save();
        res.json({ message: `Registration ${settings.registrationOpen ? 'opened' : 'closed'} successfully`, registrationOpen: settings.registrationOpen });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling registration', error: error.message });
    }
};

// Get app settings (public)
export const getAppSettings = async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ registrationOpen: settings.registrationOpen });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings', error: error.message });
    }
};

export const toggleLiveMonitoring = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Lock check: check if quiz has already become LIVE
        if (new Date().getTime() >= new Date(quiz.startTime).getTime()) {
            return res.status(400).json({ message: 'Settings locked: Cannot configure live monitoring after the quiz has started.' });
        }

        quiz.liveMonitoringEnabled = !quiz.liveMonitoringEnabled;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: `Live monitoring ${quiz.liveMonitoringEnabled ? 'enabled' : 'disabled'} successfully`, quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error configuring live monitoring', error: error.message });
    }
};

export const forceSubmitAttempt = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        if (attempt.status !== 'IN_PROGRESS') {
            return res.status(400).json({ message: `Attempt is already ${attempt.status.toLowerCase()}` });
        }

        const quiz = await Quiz.findById(attempt.quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = attempt.userId.toString();

        attempt.status = 'EXPIRED';
        attempt.submittedAt = new Date();
        await attempt.save();

        // Evaluate and create Submission
        const questionsList = await Question.find({ quizId: quiz._id }).lean();
        const answersObj = attempt.answers ? Object.fromEntries(attempt.answers) : {};
        
        const { score, evaluatedAnswers } = evaluateAttemptScore(answersObj, questionsList, quiz);

        const submission = await Submission.create({
            userId: attempt.userId,
            quizId: quiz._id,
            answers: evaluatedAnswers,
            score,
            isSuspicious: true,
            tabSwitches: attempt.flagCount || 0,
            fullscreenExits: 0,
            submittedAt: new Date(),
            isPreview: attempt.isPreview || false
        });

        // Clean memory cache & compatible QuizState
        activeQuizzes?.get(actualQuizIdStr)?.users.delete(userIdStr);
        await QuizState.findOneAndDelete({ userId: attempt.userId, quizId: quiz._id });

        // Emit socket events to force-submit the client
        const io = getIO();
        if (io) {
            io.to(`attempt:${attemptId}`).emit('attempt:force-submit');
            io.to(`admin:${actualQuizIdStr}`).emit('monitor:participant', {
                userId: userIdStr,
                status: 'EXPIRED',
                attemptId
            });
        }

        res.json({ message: 'Attempt force submitted successfully', submission });
    } catch (error) {
        res.status(500).json({ message: 'Error forcing submission', error: error.message });
    }
};

export const invalidateAttemptSession = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        const quiz = await Quiz.findById(attempt.quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const actualQuizIdStr = quiz._id.toString();
        const userIdStr = attempt.userId.toString();

        attempt.status = 'ABANDONED';
        await attempt.save();

        // Clean memory cache & compatible QuizState
        activeQuizzes?.get(actualQuizIdStr)?.users.delete(userIdStr);
        await QuizState.findOneAndDelete({ userId: attempt.userId, quizId: quiz._id });

        // Emit session-invalid event to student socket and evict them
        const io = getIO();
        if (io) {
            io.to(`attempt:${attemptId}`).emit('attempt:session-invalid', { reason: 'Your session has been invalidated by the administrator.' });
            io.to(`admin:${actualQuizIdStr}`).emit('monitor:participant', {
                userId: userIdStr,
                status: 'ABANDONED',
                attemptId
            });
        }

        res.json({ message: 'Attempt session invalidated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error invalidating session', error: error.message });
    }
};

export const updateQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        // Enforce lock check on Live/Completed or started quizzes
        const isLocked = isQuizLocked(quiz);
        const criticalFields = [
            'startTime', 'duration', 'randomizeQuestions', 'randomizeOptions',
            'numberOfQuestions', 'allowQuestionNavigation', 'allowAnswerChange',
            'marksPerQuestion', 'negativeMarkingEnabled', 'negativeMarks',
            'oneAttemptOnly', 'singleActiveSession', 'fullscreenRequired', 'tabSwitchMonitoring'
        ];

        if (isLocked) {
            for (const field of criticalFields) {
                if (req.body[field] !== undefined && req.body[field] !== quiz[field]) {
                    // Normalize Date string comparison for startTime
                    if (field === 'startTime') {
                        if (new Date(req.body.startTime).getTime() === new Date(quiz.startTime).getTime()) {
                            continue;
                        }
                    }
                    return res.status(400).json({ message: `Settings locked: Cannot modify critical field '${field}' once the quiz has started.` });
                }
            }
        }

        // Fields permitted for modification
        const allowedFields = [
            'title', 'description', 'instructions', 'timezone', 'status',
            'startTime', 'duration', 'randomizeQuestions', 'randomizeOptions',
            'numberOfQuestions', 'allowQuestionNavigation', 'allowAnswerChange',
            'marksPerQuestion', 'negativeMarkingEnabled', 'negativeMarks',
            'oneAttemptOnly', 'singleActiveSession', 'fullscreenRequired', 'tabSwitchMonitoring',
            'liveMonitoringEnabled', 'resultsPublished', 'leaderboardPublished',
            'showScoreAfterSubmit', 'showCorrectAnswers', 'showExplanations', 'allowQuestionImages'
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'startTime') {
                    quiz.startTime = new Date(req.body.startTime);
                } else {
                    quiz[field] = req.body[field];
                }
            }
        }

        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: 'Quiz updated successfully', quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error updating quiz', error: error.message });
    }
};
