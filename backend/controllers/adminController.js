import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import QuizState from '../models/QuizState.js';
import Attempt from '../models/Attempt.js';
import AppSettings from '../models/AppSettings.js';
import { invalidateQuizCache } from './quizController.js';

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
        const { title, quizCode, duration, startTime } = req.body;
        const quiz = await Quiz.create({
            title,
            quizCode: quizCode.toUpperCase(),
            duration,
            startTime
        });
        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quiz', error: error.message });
    }
};

export const addQuestion = async (req, res) => {
    try {
        const { quizId, question, options, correctAnswer, image } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const newQuestion = await Question.create({
            quizId,
            question,
            options,
            correctAnswer,
            image
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
        const { question, options, correctAnswer, image } = req.body;
        
        const updatedQuestion = await Question.findByIdAndUpdate(
            questionId,
            { question, options, correctAnswer, image },
            { new: true, runValidators: true }
        );
        
        if (!updatedQuestion) return res.status(404).json({ message: 'Question not found' });
        
        invalidateQuizCache(updatedQuestion.quizId);
        res.json(updatedQuestion);
    } catch (error) {
        res.status(500).json({ message: 'Error updating question', error: error.message });
    }
};

export const deleteQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const deletedQuestion = await Question.findByIdAndDelete(questionId);
        
        if (!deletedQuestion) return res.status(404).json({ message: 'Question not found' });
        
        invalidateQuizCache(deletedQuestion.quizId);
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

        // Get submitted users
        const submissions = await Submission.find({ quizId })
            .populate('userId', 'name email isBlocked');

        // Get currently active quiz takers (have active Attempt but haven't submitted yet)
        const activeStates = await Attempt.find({ quizId, status: 'IN_PROGRESS' })
            .populate('userId', 'name email isBlocked');

        const totalUsers = await User.countDocuments({ role: 'user' });

        // Build submitted attendees list
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

        // Build active (in-progress) attendees list
        const active = activeStates.map(s => ({
            _id: s.userId?._id,
            name: s.userId?.name,
            email: s.userId?.email,
            isBlocked: s.userId?.isBlocked,
            score: null,
            isSuspicious: s.flagCount > 0,
            status: 'in_progress',
            flagCount: s.flagCount || 0,
            flagEvents: s.flagEvents || [],
            startedAt: s.startedAt
        }));

        res.json({
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
