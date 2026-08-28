import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function resetUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');
        const user = await User.findOne({ email: 'priyadharsan272006@gmail.com' });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        user.isApproved = false;
        await user.save();
        console.log('User reset successfully. isApproved:', user.isApproved);
        process.exit(0);
    } catch (e) {
        console.error('Error during reset:', e);
        process.exit(1);
    }
}
resetUser();
