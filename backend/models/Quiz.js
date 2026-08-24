import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    quizCode: { type: String, required: true, unique: true },
    duration: { type: Number, required: true }, // in minutes
    startTime: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    resultsPublished: { type: Boolean, default: false },
    leaderboardPublished: { type: Boolean, default: false },
    liveMonitoringEnabled: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Quiz', quizSchema);
