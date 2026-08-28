import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function testApprove() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');
        const user = await User.findOne({ email: 'priyadharsan272006@gmail.com' });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        console.log('User found. Current isApproved:', user.isApproved);
        user.isApproved = true;
        await user.save();
        console.log('User saved successfully. New isApproved:', user.isApproved);
        process.exit(0);
    } catch (e) {
        console.error('❌ Error during approve:', e);
        process.exit(1);
    }
}
testApprove();
