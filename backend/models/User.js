import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    score: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    registerNumber: { type: String },
    year: { type: String, enum: ['I', 'II', 'III', 'IV'] },
    department: { type: String, enum: ['ECE', 'EEE', 'CSE', 'IT', 'AIDS', 'BME'] },
    college: { type: String, enum: ['SVHEC', 'Others'] },
    otherCollegeName: { type: String },
    isApproved: { type: Boolean, default: false },
    resetPasswordStatus: { type: String, enum: ['none', 'pending', 'approved'], default: 'none' },
    allowedQuizzesAttempts: { type: Map, of: Number, default: {} },
    phoneNumber: { type: String, default: '' },
    profileImage: { type: String, default: '' }
}, { timestamps: true });

userSchema.pre('save', function() {
    if (this.role === 'admin') {
        this.isApproved = true;
    }
});

export default mongoose.model('User', userSchema);
