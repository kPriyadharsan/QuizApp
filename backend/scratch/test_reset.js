import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: './.env' });

const uri = process.env.MONGODB_URI;
console.log("Connecting to:", uri);

mongoose.connect(uri)
.then(async () => {
    console.log("Connected to MongoDB.");
    
    // Find or create a dummy user
    let user = await User.findOne({ role: 'user' });
    if (!user) {
        console.log("No user found. Creating a test student...");
        user = await User.create({
            name: "Test Student",
            email: "student@test.com",
            password: "hashedpassword123",
            role: "user"
        });
    }

    console.log("Initial user.allowedQuizzesAttempts:", user.allowedQuizzesAttempts);

    const quizId = new mongoose.Types.ObjectId().toString();
    const submissionCount = 0;

    try {
        if (!user.allowedQuizzesAttempts) {
            user.allowedQuizzesAttempts = new Map();
        }

        if (user.allowedQuizzesAttempts instanceof Map) {
            user.allowedQuizzesAttempts.set(quizId, submissionCount + 1);
        } else {
            user.allowedQuizzesAttempts = {
                ...user.allowedQuizzesAttempts,
                [quizId]: submissionCount + 1
            };
        }

        user.markModified('allowedQuizzesAttempts');
        await user.save();
        console.log("✅ User successfully saved!");
        console.log("Updated user.allowedQuizzesAttempts:", user.allowedQuizzesAttempts);
    } catch (err) {
        console.error("❌ Save failed with error:", err);
    }

    process.exit(0);
})
.catch(err => {
    console.error("Connection failed:", err);
    process.exit(1);
});
