import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    quizId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Quiz', 
        required: true 
    },
    sessionId: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'], 
        default: 'CREATED' 
    },
    deviceUsed: {
        type: String,
        default: 'Desktop'
    },
    startedAt: { 
        type: Date 
    },
    expiresAt: { 
        type: Date 
    },
    submittedAt: { 
        type: Date 
    },
    lastSeenAt: { 
        type: Date 
    },
    currentQuestionIndex: { 
        type: Number, 
        default: 0 
    },
    questionOrder: [{
        questionId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Question', 
            required: true 
        },
        options: { 
            type: [String], 
            required: true 
        }
    }],
    answers: { 
        type: Map, 
        of: String, 
        default: {} 
    },
    answerVersions: {
        type: Map,
        of: {
            clientSequence: { type: Number, default: 0 },
            timestamp: { type: Date }
        },
        default: {}
    },
    answeredCount: { 
        type: Number, 
        default: 0 
    },
    connectionStatus: { 
        type: String, 
        enum: ['CONNECTED', 'DISCONNECTED'], 
        default: 'DISCONNECTED' 
    },
    ipAddress: { 
        type: String 
    },
    userAgent: { 
        type: String 
    },
    flagCount: { 
        type: Number, 
        default: 0 
    },
    flagEvents: [{
        type: { 
            type: String, 
            enum: ['tab_switch', 'fullscreen_exit', 'page_blur', 'refresh'], 
            required: true 
        },
        timestamp: { 
            type: Date, 
            default: Date.now 
        }
    }],
    isPreview: { type: Boolean, default: false }
}, { timestamps: true });

// Compound indexes
attemptSchema.index({ userId: 1, quizId: 1 }, { unique: true });
attemptSchema.index({ quizId: 1, status: 1 });
attemptSchema.index({ quizId: 1, userId: 1 });
attemptSchema.index({ sessionId: 1 }, { unique: true });
attemptSchema.index({ expiresAt: 1 });
attemptSchema.index({ lastSeenAt: 1 });

export default mongoose.model('Attempt', attemptSchema);
