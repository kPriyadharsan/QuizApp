import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import QuizState from '../models/QuizState.js';
import Attempt from '../models/Attempt.js';
import AppSettings from '../models/AppSettings.js';
import { invalidateQuizCache, activeQuizzes, evaluateAttemptScore } from './quizController.js';
import { getIO } from '../socket.js';
import { validateFiles, processDocument } from '../utils/documentExtractor.js';
import { parseMCQ } from '../utils/mcqParser.js';
import { parseAnswerKeys, matchAndValidate } from '../utils/answerKeyParser.js';
import { extractAmbiguousSectionsWithAI } from '../services/aiService.js';

const isQuizLocked = (quiz) => {
    if (!quiz) return false;
    return quiz.status === 'LIVE' || quiz.status === 'COMPLETED';
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
        const { quizId, sortField, sortOrder, limit: limitQuery, page: pageQuery, year, department, attendanceStatus } = req.query;
        const page = parseInt(pageQuery) || 1;
        const limit = parseInt(limitQuery) || 10;
        const skip = (page - 1) * limit;

        const submissionFilter = {};
        if (quizId && quizId !== 'all') {
            submissionFilter.quizId = quizId;
        }

        // Fetch submissions
        let submissions = await Submission.find(submissionFilter)
            .populate('userId', 'name email registerNumber year department college')
            .populate('quizId', 'title')
            .lean();

        let list = [];

        // If quizId is specific, we can compute attendance list (attended & unattended)
        if (quizId && quizId !== 'all') {
            // Get all approved users who are students
            const allStudents = await User.find({ role: 'user', isApproved: true }).lean();
            const quiz = await Quiz.findById(quizId).select('title').lean();

            // Map users to their submissions
            const userSubmissionsMap = {};
            submissions.forEach(sub => {
                const uid = sub.userId?._id?.toString() || sub.userId?.toString();
                if (uid) {
                    if (!userSubmissionsMap[uid]) userSubmissionsMap[uid] = [];
                    userSubmissionsMap[uid].push(sub);
                }
            });

            allStudents.forEach(student => {
                const uid = student._id.toString();
                const studentSubs = userSubmissionsMap[uid] || [];

                if (studentSubs.length > 0) {
                    // Add all attempts/submissions of the student
                    studentSubs.forEach(sub => {
                        list.push({
                            ...sub,
                            attendanceStatus: 'attended'
                        });
                    });
                } else {
                    // Add a virtual unattended row
                    list.push({
                        _id: `virtual-${student._id}`,
                        userId: student,
                        quizId: quiz || { _id: quizId, title: 'Deleted Quiz' },
                        score: null,
                        attemptNumber: null,
                        timeSpent: null,
                        isSuspicious: false,
                        submittedAt: null,
                        deviceUsed: '—',
                        attendanceStatus: 'unattended'
                    });
                }
            });
        } else {
            // Just map standard submissions
            list = submissions.map(sub => ({
                ...sub,
                attendanceStatus: 'attended'
            }));
        }

        // Apply filters in memory
        if (year && year !== 'all') {
            list = list.filter(item => item.userId?.year === year);
        }
        if (department && department !== 'all') {
            list = list.filter(item => item.userId?.department === department);
        }
        if (attendanceStatus && attendanceStatus !== 'all') {
            list = list.filter(item => item.attendanceStatus === attendanceStatus);
        }

        // Sort in memory (name, registerNumber, score, timeSpent, submittedAt)
        if (sortField) {
            const order = sortOrder === 'desc' ? -1 : 1;
            list.sort((a, b) => {
                let valA, valB;
                if (sortField === 'name') {
                    valA = a.userId?.name || '';
                    valB = b.userId?.name || '';
                } else if (sortField === 'registerNumber') {
                    valA = a.userId?.registerNumber || '';
                    valB = b.userId?.registerNumber || '';
                } else if (sortField === 'score') {
                    valA = a.score !== null && a.score !== undefined ? a.score : -1;
                    valB = b.score !== null && b.score !== undefined ? b.score : -1;
                } else if (sortField === 'timeSpent') {
                    valA = a.timeSpent || 0;
                    valB = b.timeSpent || 0;
                } else {
                    valA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                    valB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                }

                if (typeof valA === 'string') {
                    return valA.localeCompare(valB, undefined, { sensitivity: 'base' }) * order;
                }
                if (valA < valB) return -1 * order;
                if (valA > valB) return 1 * order;
                return 0;
            });
        } else {
            // Default sort by submittedAt desc
            list.sort((a, b) => {
                const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                return timeB - timeA;
            });
        }

        const total = list.length;
        const paginatedList = list.slice(skip, skip + limit);

        res.json({
            submissions: paginatedList,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("❌ Error in getResults:", error);
        res.status(500).json({ message: 'Error fetching results', error: error.message });
    }
};

export const restartQuizAttempt = async (req, res) => {
    try {
        const { userId, quizId } = req.body;
        if (!userId || !quizId) {
            return res.status(400).json({ message: 'User ID and Quiz ID are required' });
        }

        // Delete active/completed attempt sessions
        await Attempt.deleteMany({ userId, quizId });
        await QuizState.deleteMany({ userId, quizId });

        // Find how many submissions the user already has
        const submissionCount = await Submission.countDocuments({ userId, quizId });

        // Update allowedQuizzesAttempts directly via MongoDB $set to bypass validations
        const updateResult = await User.updateOne(
            { _id: userId },
            { $set: { [`allowedQuizzesAttempts.${quizId.toString()}`]: submissionCount + 1 } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            message: 'Quiz attempt reset successfully. The student can now retake the quiz.',
            allowedAttempts: submissionCount + 1
        });
    } catch (error) {
        console.error("❌ Error in restartQuizAttempt:", error);
        res.status(500).json({ message: 'Error resetting quiz attempt', error: error.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { isApproved, year, department, resetPasswordStatus } = req.query;

        const query = { role: 'user' };
        if (isApproved !== undefined) {
            query.isApproved = isApproved === 'true';
        }
        if (year) {
            query.year = year;
        }
        if (department) {
            query.department = department;
        }
        if (resetPasswordStatus) {
            query.resetPasswordStatus = resetPasswordStatus;
        }

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('name email score isBlocked createdAt registerNumber year department college otherCollegeName isApproved resetPasswordStatus profileImage phoneNumber')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

export const approveUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.isApproved = true;
        await user.save();
        res.json({ message: 'User approved successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Error approving user', error: error.message });
    }
};

export const rejectUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await User.findByIdAndDelete(userId);
        res.json({ message: 'User registration request rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting user', error: error.message });
    }
};

export const approvePasswordReset = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.resetPasswordStatus = 'approved';
        await user.save();
        res.json({ message: 'Password reset request approved. Student can now change their password.', user });
    } catch (error) {
        res.status(500).json({ message: 'Error approving password reset', error: error.message });
    }
};

export const rejectPasswordReset = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.resetPasswordStatus = 'none';
        await user.save();
        res.json({ message: 'Password reset request cancelled', user });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting password reset', error: error.message });
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

export const toggleArchiveQuiz = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.isArchived = !quiz.isArchived;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: `Quiz ${quiz.isArchived ? 'archived' : 'unarchived'} successfully`, quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling quiz archive status', error: error.message });
    }
};

export const toggleAnswerKey = async (req, res) => {
    try {
        const { quizId } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        quiz.showCorrectAnswers = !quiz.showCorrectAnswers;
        await quiz.save();
        invalidateQuizCache(quizId);
        res.json({ message: `Correct answers ${quiz.showCorrectAnswers ? 'enabled' : 'disabled'} successfully`, quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling answer key visibility', error: error.message });
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const quiz = await Quiz.findById(quizId).lean();
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const activeCount = quiz.liveMonitoringEnabled 
            ? await Attempt.countDocuments({ quizId, status: { $in: ['IN_PROGRESS', 'EXPIRED'] } })
            : 0;
        const submittedCount = await Submission.countDocuments({ quizId });
        const total = activeCount + submittedCount;

        let active = [];
        let submitted = [];

        // Fetch active attempts if the range overlaps
        if (quiz.liveMonitoringEnabled && skip < activeCount) {
            const activeLimit = Math.min(limit, activeCount - skip);
            const activeStates = await Attempt.find({ quizId, status: { $in: ['IN_PROGRESS', 'EXPIRED'] } })
                .populate('userId', 'name email isBlocked')
                .skip(skip)
                .limit(activeLimit)
                .lean();

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

        // Fetch submissions if the range overlaps
        const submissionSkip = Math.max(0, skip - activeCount);
        const submissionLimit = limit - active.length;

        if (submissionLimit > 0 && submissionSkip < submittedCount) {
            const submissions = await Submission.find({ quizId })
                .populate('userId', 'name email isBlocked')
                .skip(submissionSkip)
                .limit(submissionLimit)
                .lean();

            submitted = submissions.map(s => ({
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
        }

        const totalUsers = await User.countDocuments({ role: 'user' });

        res.json({
            liveMonitoringEnabled: quiz.liveMonitoringEnabled,
            attendees: [...active, ...submitted],
            totalUsers,
            attendeeCount: total,
            activeCount,
            submittedCount,
            page,
            pages: Math.ceil(total / limit)
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
            'startTime', 'duration', 'randomizeQuestions', 'randomizeOptions', 'numberOfQuestions'
        ];

        if (isLocked) {
            for (const field of criticalFields) {
                if (req.body[field] !== undefined) {
                    const bodyVal = req.body[field];
                    let dbVal = quiz[field];
                    
                    // Resolve database value fallbacks to match schema default values
                    if (dbVal === undefined || dbVal === null) {
                        if (['allowQuestionNavigation', 'allowAnswerChange', 'oneAttemptOnly', 'singleActiveSession'].includes(field)) {
                            dbVal = true;
                        } else if (field === 'marksPerQuestion') {
                            dbVal = 1;
                        } else if (field === 'duration') {
                            dbVal = 30;
                        } else {
                            dbVal = 0; // standard default for other numbers (numberOfQuestions, negativeMarks) and booleans
                        }
                    }

                    if (field === 'startTime') {
                        if (new Date(bodyVal).getTime() !== new Date(dbVal).getTime()) {
                            return res.status(400).json({ message: `Settings locked: Cannot modify critical field 'startTime' once the quiz has started.` });
                        }
                    } else if (typeof bodyVal === 'boolean') {
                        if (!!bodyVal !== !!dbVal) {
                            return res.status(400).json({ message: `Settings locked: Cannot modify critical field '${field}' once the quiz has started.` });
                        }
                    } else if (typeof bodyVal === 'number') {
                        if (Number(bodyVal) !== Number(dbVal)) {
                            return res.status(400).json({ message: `Settings locked: Cannot modify critical field '${field}' once the quiz has started.` });
                        }
                    } else {
                        if (bodyVal !== dbVal) {
                            return res.status(400).json({ message: `Settings locked: Cannot modify critical field '${field}' once the quiz has started.` });
                        }
                    }
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

export const importQuestions = async (req, res) => {
    try {
        const { quizId, questions, replace } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (isQuizLocked(quiz)) {
            return res.status(400).json({ message: 'Settings locked: Cannot import questions after the quiz has started.' });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'No questions provided for import.' });
        }

        // Validate each question structure and content
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
                return res.status(400).json({ message: `Question at index ${i} has empty or invalid question text.` });
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                return res.status(400).json({ message: `Question at index ${i} must have exactly 4 options.` });
            }
            for (let j = 0; j < 4; j++) {
                if (typeof q.options[j] !== 'string' || !q.options[j].trim()) {
                    return res.status(400).json({ message: `Question at index ${i} option ${j + 1} is empty or invalid.` });
                }
            }
            if (!q.correctAnswer || typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
                return res.status(400).json({ message: `Question at index ${i} has empty or invalid correct answer.` });
            }
            const trimmedOptions = q.options.map(opt => opt.trim());
            const trimmedCorrect = q.correctAnswer.trim();
            if (!trimmedOptions.includes(trimmedCorrect)) {
                return res.status(400).json({ message: `Question at index ${i} correct answer "${trimmedCorrect}" must match one of the options.` });
            }
        }

        // Format questions for saving
        const formattedQuestions = questions.map(q => ({
            quizId,
            question: q.question.trim(),
            options: q.options.map(opt => opt.trim()),
            correctAnswer: q.correctAnswer.trim(),
            image: q.image || '',
            explanation: q.explanation ? q.explanation.trim() : '',
            explanationImage: q.explanationImage || ''
        }));

        if (replace) {
            console.log(`🧹 Replacing existing questions for Quiz: ${quizId}`);
            await Question.deleteMany({ quizId });
        }

        const docs = await Question.insertMany(formattedQuestions);
        invalidateQuizCache(quizId);

        res.status(201).json({
            message: `Successfully imported ${docs.length} questions.`,
            count: docs.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error importing questions', error: error.message });
    }
};

export const extractDocument = async (req, res) => {
    try {
        const files = req.files;
        let aiUsedCount = 0;
        
        // 1. Validation
        validateFiles(files);
        
        // 2. Extract content from each file
        const documents = [];
        for (const file of files) {
            const docRep = await processDocument(file);
            documents.push(docRep);
        }
        
        // 3. Parse MCQ question candidates deterministically
        let allQuestions = [];
        for (const doc of documents) {
            const parsed = parseMCQ(doc);
            allQuestions = allQuestions.concat(parsed);
        }
        
        // 4. Optional AI Fallback for Ambiguous / Low-Confidence Sections
        const apiKey = process.env.AI_API_KEY;
        const provider = process.env.AI_PROVIDER || 'gemini';
        const modelName = process.env.AI_MODEL;
        
        let aiRateLimitErrorOccurred = false;
        const isRateLimitError = (err) => {
            const msg = (err.message || '').toLowerCase();
            return msg.includes('429') || 
                   msg.includes('quota') || 
                   msg.includes('rate limit') || 
                   msg.includes('limit exceeded') || 
                   msg.includes('too many requests');
        };

        if (apiKey) {
            if (allQuestions.length === 0) {
                console.log('⚠️ Deterministic parser extracted 0 questions. Running AI fallback on full document text...');
                const fullText = documents.map(doc => 
                    doc.blocks.map(b => b.text).join('\n')
                ).join('\n---\n');

                if (fullText.trim()) {
                    try {
                        const aiResult = await extractAmbiguousSectionsWithAI(fullText, provider, apiKey, modelName);
                        aiUsedCount++;
                        if (aiResult && Array.isArray(aiResult.questions)) {
                            allQuestions = aiResult.questions.map((aiQ, idx) => ({
                                sourceNumber: aiQ.sourceNumber || (idx + 1),
                                questionText: aiQ.questionText || '',
                                options: {
                                    A: aiQ.options?.A || '',
                                    B: aiQ.options?.B || '',
                                    C: aiQ.options?.C || '',
                                    D: aiQ.options?.D || ''
                                },
                                confidence: aiQ.confidence || 1.0,
                                isAiParsed: true,
                                warnings: aiQ.warnings || [],
                                sourcePage: 1,
                                sourceText: aiQ.questionText || ''
                            }));
                        }
                    } catch (aiError) {
                        console.error('⚠️ Optional AI Fallback on full text failed:', aiError.message);
                        if (isRateLimitError(aiError)) {
                            aiRateLimitErrorOccurred = true;
                        }
                    }
                }
            } else {
                const ambiguousCandidates = allQuestions.filter(q => q.confidence < 0.8);
                
                if (ambiguousCandidates.length > 0) {
                    try {
                        // Group ambiguous blocks text to process in a single token-efficient request
                        const ambiguousText = ambiguousCandidates.map((q, idx) => 
                            `Candidate #${idx + 1}\nQuestion Number: ${q.sourceNumber || 'None'}\nOriginal Text:\n${q.sourceText}`
                        ).join('\n---\n');
                        
                        const aiResult = await extractAmbiguousSectionsWithAI(ambiguousText, provider, apiKey, modelName);
                        aiUsedCount++;
                    
                        if (aiResult && Array.isArray(aiResult.questions)) {
                            const cleanStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            
                            // Map AI results for merging
                            aiResult.questions.forEach((aiQ, idx) => {
                                // Find the candidate (try matching by sourceNumber first, fallback to order index)
                                let candidate = null;
                                if (aiQ.sourceNumber !== null && aiQ.sourceNumber !== undefined) {
                                    candidate = ambiguousCandidates.find(q => q.sourceNumber === aiQ.sourceNumber);
                                }
                                if (!candidate) {
                                    candidate = ambiguousCandidates[idx];
                                }
                                
                                if (candidate) {
                                    // Conflict check: does AI output differ significantly from deterministically resolved fields?
                                    const qConflict = !!(cleanStr(candidate.questionText) !== cleanStr(aiQ.questionText) && candidate.questionText.trim() && aiQ.questionText.trim());
                                    const optConflict = ['A', 'B', 'C', 'D'].some(o => 
                                        !!(cleanStr(candidate.options[o]) !== cleanStr(aiQ.options?.[o]) && candidate.options[o].trim() && aiQ.options?.[o]?.trim())
                                    );
                                    
                                    if (qConflict || optConflict) {
                                        candidate.isConflict = true;
                                        candidate.warnings.push('CONFLICT: AI output differs from deterministic parsing.');
                                        candidate.confidence = 0.5;
                                        candidate.aiFallback = aiQ;
                                    } else {
                                        // No conflict, merge AI improvements
                                        candidate.isAiParsed = true;
                                        candidate.questionText = aiQ.questionText || candidate.questionText;
                                        candidate.options = {
                                            A: aiQ.options?.A || candidate.options.A,
                                            B: aiQ.options?.B || candidate.options.B,
                                            C: aiQ.options?.C || candidate.options.C,
                                            D: aiQ.options?.D || candidate.options.D
                                        };
                                        candidate.confidence = 1.0;
                                        // Clear structural warnings that AI solved
                                        candidate.warnings = candidate.warnings.filter(w => 
                                            !w.includes('Missing option label') && !w.includes('Missing question text')
                                        );
                                        if (aiQ.warnings && aiQ.warnings.length > 0) {
                                            candidate.warnings.push(...aiQ.warnings.map(w => `[AI Warning] ${w}`));
                                        }
                                    }
                                }
                            });
                        }
                    } catch (aiError) {
                        console.error('⚠️ Optional AI Fallback failed:', aiError.message);
                        if (isRateLimitError(aiError)) {
                            aiRateLimitErrorOccurred = true;
                        }
                    }
                }
            }
            if (allQuestions.length === 0 && aiRateLimitErrorOccurred) {
                return res.status(429).json({ 
                    message: 'AI rate limit exceeded. Please try again in a few minutes.', 
                    error: 'AI_RATE_LIMIT_EXCEEDED' 
                });
            }
        } else {
            console.log('🤖 AI Fallback is disabled (AI_API_KEY is not defined in .env).');
        }
        
        // 5. Parse Answer keys
        const answersResult = parseAnswerKeys(documents);
        
        // 6. Match and Validate
        const report = matchAndValidate(allQuestions, answersResult);
        
        if (apiKey && aiRateLimitErrorOccurred) {
            report.warnings.push("AI Rate Limit Exceeded: The AI could not help parse ambiguous sections because the rate limit was reached. Please try again in a few minutes or verify manually.");
        }

        res.json({
            message: 'Documents parsed and validated successfully.',
            report,
            documents,
            aiStats: {
                aiUsed: aiUsedCount > 0,
                callsCount: aiUsedCount
            }
        });
    } catch (error) {
        res.status(400).json({ message: 'Document extraction and validation failed.', error: error.message });
    }
};
