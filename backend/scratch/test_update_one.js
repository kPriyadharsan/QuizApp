import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    const userId = "6a8e956bd721c3694ad129b8"; // Priyadharsan k
    const quizId = "6a8e96ada93e01f63f6798a3"; // TEST 1

    try {
        console.log("Updating allowedQuizzesAttempts via updateOne...");
        const result = await User.updateOne(
            { _id: userId },
            { $set: { [`allowedQuizzesAttempts.${quizId}`]: 2 } }
        );
        console.log("Update result:", result);

        const updatedUser = await User.findById(userId);
        console.log("Updated user allowedQuizzesAttempts:", updatedUser.allowedQuizzesAttempts);
    } catch (err) {
        console.error("Update failed:", err);
    }
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
