import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    quizCode: { type: String, required: true, unique: true },
    duration: { type: Number, required: true }, // in minutes
    startTime: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    resultsPublished: { type: Boolean, default: false },
    leaderboardPublished: { type: Boolean, default: false },
    liveMonitoringEnabled: { type: Boolean, default: false },

    // Expanded Settings
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },
    status: { type: String, enum: ['DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED'], default: 'DRAFT' },

    randomizeQuestions: { type: Boolean, default: false },
    randomizeOptions: { type: Boolean, default: false },
    numberOfQuestions: { type: Number, default: 0 },
    allowQuestionNavigation: { type: Boolean, default: true },
    allowAnswerChange: { type: Boolean, default: true },

    marksPerQuestion: { type: Number, default: 1 },
    negativeMarkingEnabled: { type: Boolean, default: false },
    negativeMarks: { type: Number, default: 0 },

    oneAttemptOnly: { type: Boolean, default: true },
    singleActiveSession: { type: Boolean, default: true },
    fullscreenRequired: { type: Boolean, default: false },
    tabSwitchMonitoring: { type: Boolean, default: false },

    showScoreAfterSubmit: { type: Boolean, default: true },
    showCorrectAnswers: { type: Boolean, default: false },
    showExplanations: { type: Boolean, default: false },
    allowQuestionImages: { type: Boolean, default: true }
}, { timestamps: true });

quizSchema.index({ status: 1, startTime: 1 });
quizSchema.index({ isActive: 1, startTime: 1 });

export default mongoose.model('Quiz', quizSchema);
