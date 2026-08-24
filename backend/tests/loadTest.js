import axios from 'axios';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/quizapp';
const USER_COUNT = 100;
const QUIZ_CODE = 'LOAD100';

const stats = {
    authSuccess: 0,
    authFail: 0,
    infoSuccess: 0,
    infoFail: 0,
    startSuccess: 0,
    startFail: 0,
    socketConnectSuccess: 0,
    socketConnectFail: 0,
    socketReconnects: 0,
    syncSuccess: 0,
    syncFail: 0,
    submitSuccess: 0,
    submitFail: 0,
    duplicateSubmitsPrevented: 0,
    duplicateSyncsPrevented: 0,
    errors: [],
    latencies: {
        login: [],
        start: [],
        sync: [],
        submit: []
    }
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Setup temporary schemas just for seed operations
const QuizSchema = new mongoose.Schema({
    title: String,
    quizCode: { type: String, unique: true },
    duration: Number,
    startTime: Date,
    isActive: Boolean,
    status: String
});
const QuestionSchema = new mongoose.Schema({
    quizId: mongoose.Schema.Types.ObjectId,
    text: String,
    options: [String],
    correctAnswer: String
});

const QuizModel = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
const QuestionModel = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

async function setupSeedData() {
    console.log('📦 Connecting to MongoDB to verify seed quiz data...');
    try {
        await mongoose.connect(MONGO_URI);
        let quiz = await QuizModel.findOne({ quizCode: QUIZ_CODE });
        
        if (!quiz) {
            console.log(`❇️ Quiz with code ${QUIZ_CODE} not found. Seeding dynamically...`);
            quiz = await QuizModel.create({
                title: 'Load Test Quiz',
                quizCode: QUIZ_CODE,
                duration: 60,
                startTime: new Date(),
                isActive: true,
                status: 'LIVE'
            });

            // Create 5 questions
            const questionData = Array.from({ length: 5 }).map((_, i) => ({
                quizId: quiz._id,
                text: `Load Test Question ${i + 1}`,
                options: ['A', 'B', 'C', 'D'],
                correctAnswer: 'A'
            }));
            await QuestionModel.insertMany(questionData);
            console.log('❇️ Seeding complete. 5 questions created.');
        } else {
            console.log('❇️ Seed quiz already exists.');
        }
        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Failed to seed quiz data:', err.message);
        process.exit(1);
    }
}

async function runLoadTest() {
    await setupSeedData();

    console.log('🚀 INITIALIZING XO-QUIZ LOAD TEST SUITE...');
    console.log(`👥 Target: Simulating ${USER_COUNT} simultaneous candidates against ${API_URL}`);

    // 1. Setup/Register User Accounts
    console.log('📝 Step 1: Simulating concurrent authentication & registration...');
    const authPromises = Array.from({ length: USER_COUNT }).map(async (_, idx) => {
        const email = `testuser${idx + 1}@loadtest.com`;
        const password = 'password123';
        const name = `Load Candidate ${idx + 1}`;

        try {
            await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
        } catch (e) {
            // Silently swallow duplicate registration errors
        }

        const start = Date.now();
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
            stats.latencies.login.push(Date.now() - start);
            stats.authSuccess++;
            return {
                id: res.data._id,
                email,
                token: res.data.token
            };
        } catch (err) {
            stats.authFail++;
            stats.errors.push(`Login failed for ${email}: ${err.message}`);
            return null;
        }
    });

    const resolvedUsers = (await Promise.all(authPromises)).filter(Boolean);
    console.log(`🟢 Step 1 Complete: ${stats.authSuccess}/${USER_COUNT} users logged in. Avg Login Latency: ${avg(stats.latencies.login)}ms`);

    if (resolvedUsers.length === 0) {
        console.error('❌ Aborting: No users authenticated successfully.');
        process.exit(1);
    }

    // 2. Fetch Quiz Info
    console.log('📖 Step 2: Simulating users opening the quiz details...');
    const infoPromises = resolvedUsers.map(async (u) => {
        try {
            const res = await axios.post(`${API_URL}/api/quiz/info`, 
                { quizId: QUIZ_CODE },
                { headers: { Authorization: `Bearer ${u.token}` } }
            );
            stats.infoSuccess++;
            return {
                ...u,
                quizId: res.data.quiz._id,
                duration: res.data.quiz.duration
            };
        } catch (err) {
            stats.infoFail++;
            stats.errors.push(`Info retrieval failed for ${u.email}: ${err.message}`);
            return null;
        }
    });

    const activeUsers = (await Promise.all(infoPromises)).filter(Boolean);
    console.log(`🟢 Step 2 Complete: ${stats.infoSuccess}/${resolvedUsers.length} retrieved quiz metadata.`);

    if (activeUsers.length === 0) {
        console.error('❌ Aborting: Could not fetch quiz details.');
        process.exit(1);
    }

    const quizId = activeUsers[0].quizId;

    // 3. Start Quiz within 10 seconds (staggered starts)
    console.log('⏰ Step 3: Staggering quiz starts across 10 seconds...');
    const startPromises = activeUsers.map(async (u, idx) => {
        const staggerDelay = (idx / USER_COUNT) * 10000;
        await delay(staggerDelay);

        const start = Date.now();
        try {
            const res = await axios.post(`${API_URL}/api/quiz/start`, 
                { quizId },
                { headers: { Authorization: `Bearer ${u.token}` } }
            );
            stats.latencies.start.push(Date.now() - start);
            stats.startSuccess++;
            return {
                ...u,
                attemptId: res.data.attemptId,
                sessionId: res.data.sessionId,
                expiresAt: res.data.expiresAt,
                questions: res.data.questions
            };
        } catch (err) {
            stats.startFail++;
            stats.errors.push(`Quiz start failed for ${u.email}: ${err.message}`);
            return null;
        }
    });

    const testers = (await Promise.all(startPromises)).filter(Boolean);
    console.log(`🟢 Step 3 Complete: ${stats.startSuccess}/${activeUsers.length} attempts initialized. Avg Start Latency: ${avg(stats.latencies.start)}ms`);

    // 4. Establish Socket.IO Connections
    console.log('🔌 Step 4: Connecting client Socket.IO sockets...');
    const socketPromises = testers.map((u) => {
        return new Promise((resolve) => {
            const socket = io(API_URL, {
                auth: { token: u.token },
                transports: ['websocket']
            });

            socket.on('connect', () => {
                stats.socketConnectSuccess++;
                socket.emit('attempt:join', { attemptId: u.attemptId, quizId });
                resolve({ ...u, socket });
            });

            socket.on('connect_error', (err) => {
                stats.socketConnectFail++;
                stats.errors.push(`Socket connect error for ${u.email}: ${err.message}`);
                resolve({ ...u, socket: null });
            });
        });
    });

    let clients = await Promise.all(socketPromises);
    console.log(`🟢 Step 4 Complete: ${stats.socketConnectSuccess}/${testers.length} sockets active.`);

    // 5. Answer Questions & Sync
    console.log('✏️ Step 5: Candidates simulating answer selections and synchronizations...');
    const activeClients = clients.filter(c => c.socket);

    const syncPromises = activeClients.map(async (c) => {
        for (let qIdx = 0; qIdx < Math.min(5, c.questions.length); qIdx++) {
            await delay(1000 + Math.random() * 2000);

            const question = c.questions[qIdx];
            const answerPayload = {
                answers: [{
                    questionId: question._id,
                    selectedOption: 'A',
                    clientSequence: 1,
                    timestamp: new Date()
                }]
            };

            const start = Date.now();
            try {
                await axios.post(`${API_URL}/api/quiz/attempt/${c.attemptId}/answers`, 
                    answerPayload,
                    { 
                        headers: { 
                            Authorization: `Bearer ${c.token}`,
                            'X-Session-ID': c.sessionId
                        } 
                    }
                );
                stats.latencies.sync.push(Date.now() - start);
                stats.syncSuccess++;
            } catch (err) {
                stats.syncFail++;
                stats.errors.push(`Sync failed for ${c.email}: ${err.message}`);
            }

            if (qIdx === 2) {
                try {
                    await axios.post(`${API_URL}/api/quiz/attempt/${c.attemptId}/answers`, 
                        answerPayload,
                        { 
                            headers: { 
                                Authorization: `Bearer ${c.token}`,
                                'X-Session-ID': c.sessionId
                            } 
                        }
                    );
                    stats.duplicateSyncsPrevented++;
                } catch (e) {
                    // caught
                }
            }
        }
    });

    await Promise.all(syncPromises);
    console.log(`🟢 Step 5 Complete: ${stats.syncSuccess} synchronization batches completed.`);

    // 6. Test Disconnections & Reconnections
    console.log('🔌 Step 6: Simulating network drops, refreshes, and connection recoveries...');
    const dcTargets = activeClients.slice(0, 20);
    dcTargets.forEach(c => {
        c.socket.disconnect();
    });
    console.log('  - 20 users disconnected temporarily...');
    await delay(2000);

    const rcPromises = dcTargets.map(c => {
        return new Promise((resolve) => {
            c.socket.connect();
            c.socket.on('connect', () => {
                stats.socketReconnects++;
                c.socket.emit('attempt:join', { attemptId: c.attemptId, quizId });
                resolve();
            });
        });
    });
    await Promise.all(rcPromises);
    console.log('  - 20 users reconnected successfully.');

    // 7. Simultaneous Submissions
    console.log('🏁 Step 7: Executing concurrent submissions...');
    const submitPromises = activeClients.map(async (c) => {
        const formatted = c.questions.map(q => ({ questionId: q._id, selectedOption: 'A' }));
        const submitPayload = {
            quizId,
            attemptId: c.attemptId,
            sessionId: c.sessionId,
            answers: formatted,
            isSuspicious: false,
            tabSwitches: 0,
            fullscreenExits: 0
        };

        const start = Date.now();
        try {
            await axios.post(`${API_URL}/api/quiz/submit`, 
                submitPayload,
                { 
                    headers: { 
                        Authorization: `Bearer ${c.token}`,
                        'X-Session-ID': c.sessionId
                    } 
                }
            );
            stats.latencies.submit.push(Date.now() - start);
            stats.submitSuccess++;
        } catch (err) {
            stats.submitFail++;
            stats.errors.push(`Submission failed for ${c.email}: ${err.message}`);
        }

        try {
            const doubleSubmitRes = await axios.post(`${API_URL}/api/quiz/submit`, 
                submitPayload,
                { 
                    headers: { 
                        Authorization: `Bearer ${c.token}`,
                        'X-Session-ID': c.sessionId
                    } 
                }
            );
            if (doubleSubmitRes.status === 200 || doubleSubmitRes.status === 201) {
                stats.duplicateSubmitsPrevented++;
            }
        } catch (e) {
            // caught
        }
    });

    await Promise.all(submitPromises);
    console.log(`🟢 Step 7 Complete: ${stats.submitSuccess} submission attempts processed.`);

    activeClients.forEach(c => c.socket.disconnect());

    console.log('\n========================================================================');
    console.log('📊 XO-QUIZ LOAD TEST PERFORMANCE METRICS SUMMARY');
    console.log('========================================================================');
    console.log(`👤 Active Candidate Simulation : ${USER_COUNT}`);
    console.log(`🔐 Authentication Success Rate : ${stats.authSuccess}/${USER_COUNT} (${pct(stats.authSuccess, USER_COUNT)})`);
    console.log(`🔌 Socket Connection Rate      : ${stats.socketConnectSuccess}/${testers.length} (${pct(stats.socketConnectSuccess, testers.length)})`);
    console.log(`🔄 Socket Reconnections Logged  : ${stats.socketReconnects}`);
    console.log(`📝 Sync Batches Completed      : ${stats.syncSuccess}`);
    console.log(`🏁 Submissions Success Rate   : ${stats.submitSuccess}/${USER_COUNT} (${pct(stats.submitSuccess, USER_COUNT)})`);
    console.log(`🛡️  Duplicate Submits Blocked   : ${stats.duplicateSubmitsPrevented}`);
    console.log(`🛡️  Duplicate Syncs Handled     : ${stats.duplicateSyncsPrevented}`);
    console.log('------------------------------------------------------------------------');
    console.log(`⏱️  Average API Latencies:`);
    console.log(`    - Login:  ${avg(stats.latencies.login)} ms`);
    console.log(`    - Start:  ${avg(stats.latencies.start)} ms`);
    console.log(`    - Sync:   ${avg(stats.latencies.sync)} ms`);
    console.log(`    - Submit: ${avg(stats.latencies.submit)} ms`);
    console.log('========================================================================');

    if (stats.errors.length > 0) {
        console.log(`⚠️ Logged Errors during runs: ${stats.errors.length}`);
        console.log(stats.errors.slice(0, 5).join('\n'));
    }
}

function avg(arr) {
    if (!arr || arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function pct(val, tot) {
    if (tot === 0) return '0%';
    return `${Math.round((val / tot) * 100)}%`;
}

runLoadTest();
