import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Quiz from '../models/Quiz.js';
import Attempt from '../models/Attempt.js';

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    const users = await User.find();
    const quizzes = await Quiz.find();
    const submissions = await Submission.find();
    const attempts = await Attempt.find();

    console.log("--- USERS ---");
    console.log(users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, isApproved: u.isApproved })));

    console.log("--- QUIZZES ---");
    console.log(quizzes.map(q => ({ id: q._id, title: q.title })));

    console.log("--- SUBMISSIONS ---");
    console.log(submissions.map(s => ({ id: s._id, userId: s.userId, quizId: s.quizId, score: s.score, attemptNumber: s.attemptNumber })));

    console.log("--- ATTEMPTS ---");
    console.log(attempts.map(a => ({ id: a._id, userId: a.userId, quizId: a.quizId, status: a.status })));

    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
