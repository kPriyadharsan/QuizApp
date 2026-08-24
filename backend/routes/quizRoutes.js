import express from 'express';
import { getActiveQuizzes, getQuizInfo, startQuiz, submitQuiz, getLeaderboard, getPublishedLeaderboards, getMyResults, saveQuizState, verifyQuizCode, reportFlag, getAttemptState, syncAnswers } from '../controllers/quizController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getActiveQuizzes);
router.post('/verify-code', protect, verifyQuizCode);
router.post('/info', protect, getQuizInfo);
router.post('/start', protect, startQuiz);
router.post('/save', protect, saveQuizState);
router.post('/submit', protect, submitQuiz);
router.post('/flag', protect, reportFlag);
router.get('/attempt/:attemptId/state', protect, getAttemptState);
router.post('/attempt/:attemptId/answers', protect, syncAnswers);
router.get('/leaderboards', protect, getPublishedLeaderboards);
router.get('/leaderboard/:quizId', protect, getLeaderboard);
router.get('/my-results', protect, getMyResults);

export default router;
