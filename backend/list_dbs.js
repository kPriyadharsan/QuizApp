import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB cluster');
    
    const adminDb = mongoose.connection.db.admin();
    const dbsList = await adminDb.listDatabases();
    console.log('Available databases on Atlas:');
    for (const dbInfo of dbsList.databases) {
        console.log(` - ${dbInfo.name} (${dbInfo.sizeOnDisk} bytes)`);
        
        const client = mongoose.connection.client;
        const db = client.db(dbInfo.name);
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
            if (col.name === 'users') {
                const userDoc = await db.collection('users').findOne({ email: 'priyadharsan272006@gmail.com' });
                if (userDoc) {
                    console.log(`   🎯 FOUND USER IN DATABASE: "${dbInfo.name}" collection: "users"`);
                    console.log(`   Document details:`, {
                        _id: userDoc._id,
                        email: userDoc.email,
                        isApproved: userDoc.isApproved,
                        role: userDoc.role
                    });
                }
            }
        }
    }
    
    process.exit(0);
}
run().catch(console.error);
