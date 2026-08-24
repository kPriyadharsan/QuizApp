import rateLimit from 'express-rate-limit';

const keyGenerator = (req) => {
    return req.user?.id || req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
};

const skip = (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost') || process.env.NODE_ENV === 'test';
};

export const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 15,
    message: { message: 'Too many authentication attempts. Please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    validate: false,
    skip
});

export const quizStartLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { message: 'Too many quiz start requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    validate: false,
    skip
});

export const answerSyncLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { message: 'Answer synchronization limit exceeded. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    validate: false,
    skip
});

export const submitLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: { message: 'Quiz submission limit exceeded. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    validate: false,
    skip
});

export const flagLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { message: 'Security flag reports exceeded. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    validate: false,
    skip
});
