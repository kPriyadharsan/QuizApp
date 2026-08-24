import express from 'express';
import { getActiveQuizzes, getQuizInfo, startQuiz, submitQuiz, getLeaderboard, getPublishedLeaderboards, getMyResults, saveQuizState, verifyQuizCode, reportFlag, getAttemptState, syncAnswers, getSubmissionDetail } from '../controllers/quizController.js';
import { protect, validateExamSession } from '../middleware/authMiddleware.js';
import { quizStartLimiter, answerSyncLimiter, submitLimiter, flagLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', protect, getActiveQuizzes);
router.post('/verify-code', protect, verifyQuizCode);
router.post('/info', protect, getQuizInfo);
router.post('/start', protect, quizStartLimiter, startQuiz);
router.post('/save', protect, validateExamSession, answerSyncLimiter, saveQuizState);
router.post('/submit', protect, validateExamSession, submitLimiter, submitQuiz);
router.post('/flag', protect, flagLimiter, reportFlag);
router.get('/attempt/:attemptId/state', protect, validateExamSession, getAttemptState);
router.post('/attempt/:attemptId/answers', protect, validateExamSession, answerSyncLimiter, syncAnswers);
router.get('/leaderboards', protect, getPublishedLeaderboards);
router.get('/leaderboard/:quizId', protect, getLeaderboard);
router.get('/my-results', protect, getMyResults);
router.get('/submission/:submissionId', protect, getSubmissionDetail);

export default router;
