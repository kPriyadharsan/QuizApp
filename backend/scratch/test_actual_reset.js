import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Attempt from '../models/Attempt.js';
import QuizState from '../models/QuizState.js';
import Submission from '../models/Submission.js';

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    const userId = "6a8e956bd721c3694ad129b8"; // Priyadharsan k
    const quizId = "6a8e96ada93e01f63f6798a3"; // TEST 1

    try {
        console.log("Deleting active/completed attempt sessions...");
        const delAttempt = await Attempt.deleteMany({ userId, quizId });
        const delState = await QuizState.deleteMany({ userId, quizId });
        console.log("Deleted attempts:", delAttempt.deletedCount, "Deleted states:", delState.deletedCount);

        const user = await User.findById(userId);
        if (!user) {
            console.log("User not found!");
            process.exit(1);
        }

        const submissionCount = await Submission.countDocuments({ userId, quizId });
        console.log("Submissions count:", submissionCount);

        if (!user.allowedQuizzesAttempts) {
            user.allowedQuizzesAttempts = new Map();
        }

        if (user.allowedQuizzesAttempts instanceof Map) {
            user.allowedQuizzesAttempts.set(quizId.toString(), submissionCount + 1);
        } else {
            user.allowedQuizzesAttempts = {
                ...user.allowedQuizzesAttempts,
                [quizId.toString()]: submissionCount + 1
            };
        }

        user.markModified('allowedQuizzesAttempts');
        await user.save();
        console.log("✅ Database updated successfully! Student reset complete.");
    } catch (e) {
        console.error("❌ Reset error:", e);
    }
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
