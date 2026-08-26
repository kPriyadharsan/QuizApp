import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Submission from './models/Submission.js';
import Quiz from './models/Quiz.js';
import Attempt from './models/Attempt.js';
import QuizState from './models/QuizState.js';

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
    console.error("❌ MONGODB_URI/MONGO_URI not found in environment configuration.");
    process.exit(1);
}

console.log("Connecting to database: ", uri);

mongoose.connect(uri)
.then(async () => {
    console.log("🟢 Database connected. Commencing clean reset...");

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (let col of collections) {
        console.log(`Dropping collection: ${col.name}`);
        await mongoose.connection.db.dropCollection(col.name).catch(e => {
            console.warn(`Could not drop ${col.name}:`, e.message);
        });
    }
    
    console.log("❇️ All existing collections and indexes dropped.");

    // Seed production admin user
    const adminEmail = process.env.ADMIN_EMAIL || "dharsan@admin.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "dharsan@quiz2763";
    const adminName = process.env.ADMIN_NAME || "System Admin";

    console.log(`Seeding production administrator: ${adminEmail}`);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "admin"
    });
    
    console.log(`❇️ Admin user seeded successfully.`);

    console.log("🚀 Database successfully reset! Indexes will build automatically on server boot.");
    process.exit(0);
})
.catch(err => {
    console.error("❌ Database reset error:", err);
    process.exit(1);
});
