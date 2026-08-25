import express from 'express';
import { createQuiz, addQuestion, getQuestions, updateQuestion, deleteQuestion, getResults, getUsers, approveUser, rejectUser, approvePasswordReset, rejectPasswordReset, toggleResults, toggleLeaderboard, stopQuiz, deleteQuiz, blockUser, unblockUser, getLiveAttendees, getAllQuizzes, toggleRegistration, getAppSettings, toggleLiveMonitoring, forceSubmitAttempt, invalidateAttemptSession, updateQuiz, importQuestions, extractDocument } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.post('/create-quiz', protect, admin, createQuiz);
router.post('/add-question', protect, admin, addQuestion);
router.post('/import-questions', protect, admin, importQuestions);
router.post('/extract-document', protect, admin, upload.array('files', 2), extractDocument);
router.get('/questions/:quizId', protect, admin, getQuestions);
router.put('/question/:questionId', protect, admin, updateQuestion);
router.delete('/question/:questionId', protect, admin, deleteQuestion);
router.get('/all-quizzes', protect, admin, getAllQuizzes);
router.get('/results', protect, admin, getResults);
router.get('/users', protect, admin, getUsers);
router.post('/approve-user', protect, admin, approveUser);
router.post('/reject-user', protect, admin, rejectUser);
router.post('/approve-reset', protect, admin, approvePasswordReset);
router.post('/reject-reset', protect, admin, rejectPasswordReset);
router.post('/toggle-results', protect, admin, toggleResults);
router.post('/toggle-leaderboard', protect, admin, toggleLeaderboard);
router.post('/stop-quiz', protect, admin, stopQuiz);
router.delete('/delete-quiz/:quizId', protect, admin, deleteQuiz);
router.post('/block-user', protect, admin, blockUser);
router.post('/unblock-user', protect, admin, unblockUser);
router.get('/live-attendees/:quizId', protect, admin, getLiveAttendees);
router.post('/toggle-registration', protect, admin, toggleRegistration);
router.get('/settings', getAppSettings);

router.post('/toggle-monitoring', protect, admin, toggleLiveMonitoring);
router.post('/attempt/:attemptId/force-submit', protect, admin, forceSubmitAttempt);
router.post('/attempt/:attemptId/invalidate', protect, admin, invalidateAttemptSession);
router.put('/quiz/:quizId', protect, admin, updateQuiz);

export default router;
