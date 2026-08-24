import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
// Global Error Protection
process.on("uncaughtException", (err) => {
    console.error("🔥 Uncaught Exception:", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
});

import { initSocket } from "./socket.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

// Initialize Socket.IO using the dedicated module
const io = initSocket(httpServer);

// Also set on app for flexibility
app.set("io", io);

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

// Security Middleware
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);

app.get("/", (req, res) => {
    res.send("Quiz App API is running");
});

// Handle payload too large errors explicitly
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Payload too large. Please use a smaller image (max 5MB).' });
    }
    next(err);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Unhandled Error:", err);
    res.status(500).json({
        message: "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting server
mongoose
    .connect(process.env.MONGODB_URI, {
        maxPoolSize: 50, // Increased for high concurrency
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    })
    .then(async () => {
        console.log("Connected to MongoDB");
        
        // Seed Admin user
        try {
            const adminEmail = process.env.ADMIN_EMAIL || "dharsan@admin.com";
            const adminPassword = process.env.ADMIN_PASSWORD || "dharsan@quiz2763";
            const adminName = process.env.ADMIN_NAME || "System Admin";

            const adminExists = await User.findOne({ email: adminEmail });
            if (!adminExists) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(adminPassword, salt);
                await User.create({
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    role: "admin",
                });
                console.log("❇️ Admin user seeded successfully!");
            }
        } catch (e) {
            console.error("❌ Error seeding admin user:", e);
        }

        // Start server only after DB connects
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    });


