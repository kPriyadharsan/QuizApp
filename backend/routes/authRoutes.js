import express from 'express';
import { registerUser, loginUser, getMe, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', protect, getMe);

export default router;
