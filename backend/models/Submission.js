import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedOption: { type: String, required: true },
        isCorrect: { type: Boolean, required: true }
    }],
    score: { type: Number, required: true },
    isSuspicious: { type: Boolean, default: false },
    tabSwitches: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    attemptNumber: { type: Number, default: 1 },
    startedAt: { type: Date },
    endedAt: { type: Date },
    timeSpent: { type: Number },
    deviceUsed: { type: String, enum: ['Mobile', 'Tablet', 'Desktop'], default: 'Desktop' },
    submittedAt: { type: Date, default: Date.now },
    isPreview: { type: Boolean, default: false }
}, { timestamps: true });

// Optimize leaderboard queries
submissionSchema.index({ quizId: 1, score: -1, submittedAt: 1 });
submissionSchema.index({ quizId: 1, score: -1 });
submissionSchema.index({ quizId: 1, submittedAt: 1 });
submissionSchema.index({ userId: 1, quizId: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);
