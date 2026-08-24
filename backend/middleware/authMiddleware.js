import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            if (!token) {
                console.warn(`⚠️ [Auth] Malformed Header - Missing actual token (User-Agent: ${req.headers['user-agent']})`);
                return res.status(401).json({ message: 'Not authorized, token missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;

            // Check if user is blocked (skip for admin hardcoded id)
            const dbUser = await User.findById(decoded.id).select('isBlocked');
            if (dbUser && dbUser.isBlocked) {
                return res.status(403).json({ message: 'Your account has been blocked by the admin.', blocked: true });
            }

            return next();
        } catch (error) {
            console.error(`❌ [Auth Error] Token Verification Failed: ${error.message} (IP: ${req.ip})`);
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired, please login again' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            }
            return res.status(500).json({ message: 'Authentication verification failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

export const validateExamSession = async (req, res, next) => {
    try {
        const attemptId = req.params.attemptId || req.body.attemptId;
        const sessionId = req.headers['x-session-id'] || req.body.sessionId || req.query.sessionId;
        const quizId = req.body.quizId || req.query.quizId;

        if (!attemptId) {
            return res.status(400).json({ message: 'Attempt ID is required' });
        }

        // Import dynamically to avoid circular dependency in mongoose model loading
        const Attempt = (await import('../models/Attempt.js')).default;
        
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        // Verify JWT user matches attempt owner (IDOR Protection)
        if (attempt.userId.toString() !== req.user.id.toString()) {
            console.warn(`🚨 [Security Alert] IDOR attempt by User: ${req.user.id} on Attempt: ${attemptId} owned by User: ${attempt.userId} (IP: ${req.ip || ''})`);
            return res.status(403).json({ message: 'Access denied: You do not own this attempt.' });
        }

        // Verify attempt matches quiz ID if provided (supports both ObjectId and QuizCode)
        if (quizId) {
            const Quiz = (await import('../models/Quiz.js')).default;
            const mongooseObj = (await import('mongoose')).default;
            const isObjectId = mongooseObj.isValidObjectId(quizId);
            const query = isObjectId ? { _id: quizId } : { quizCode: quizId };
            const quiz = await Quiz.findOne(query);
            if (!quiz || attempt.quizId.toString() !== quiz._id.toString()) {
                return res.status(400).json({ message: 'Invalid request: Quiz ID mismatch.' });
            }
        }

        // Verify session ID matches
        if (!sessionId || attempt.sessionId !== sessionId) {
            console.warn(`🚨 [Security Alert] Session mismatch/takeover attempt. User: ${req.user.id}, Attempt: ${attemptId}. Expected Session: ${attempt.sessionId}, Provided: ${sessionId} (IP: ${req.ip || ''})`);
            return res.status(403).json({ 
                message: 'Active exam session detected on another device/browser. Only one active session is allowed.',
                sessionConflict: true
            });
        }

        // Attach attempt to request so controllers don't have to query it again
        req.attempt = attempt;
        next();
    } catch (error) {
        console.error('Error in validateExamSession middleware:', error);
        res.status(500).json({ message: 'Session validation failed', error: error.message });
    }
};
