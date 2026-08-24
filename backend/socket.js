import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Attempt from './models/Attempt.js';
import User from './models/User.js';

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true
        }
    });

    // Authentication middleware: validates JWT token on handshake
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Authentication error: Token missing'));
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Validate user block status
            if (decoded.id !== 'admin-id') {
                const dbUser = await User.findById(decoded.id).select('isBlocked');
                if (dbUser && dbUser.isBlocked) {
                    return next(new Error('Authentication error: User is blocked'));
                }
            }

            socket.user = {
                userId: decoded.id,
                role: decoded.role
            };
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid or expired token'));
        }
    });

    io.on("connection", (socket) => {
        socket.activeAttemptId = null;
        socket.activeQuizId = null;

        // Admin room joining
        socket.on("admin:join", async (quizId) => {
            try {
                if (!quizId) return socket.emit("error", { message: "Quiz ID required" });
                if (socket.user.role !== 'admin') {
                    return socket.emit("error", { message: "Unauthorized: Admin access required" });
                }

                const roomName = `admin:${quizId.toString()}`;
                socket.join(roomName);
                socket.activeAdminRoom = roomName;
                socket.emit('admin:confirmed', { room: roomName });
            } catch (err) {
                socket.emit("error", { message: "Failed to join admin room", error: err.message });
            }
        });

        socket.on("admin:leave", (quizId) => {
            if (!quizId) return;
            const roomName = `admin:${quizId.toString()}`;
            socket.leave(roomName);
            if (socket.activeAdminRoom === roomName) delete socket.activeAdminRoom;
        });

        // Student attempt room joining (strictly verified)
        socket.on("attempt:join", async (payload) => {
            try {
                const { attemptId, quizId } = payload || {};
                if (!attemptId || !quizId) {
                    return socket.emit("error", { message: "Attempt ID and Quiz ID are required" });
                }

                const attempt = await Attempt.findById(attemptId);
                if (!attempt) {
                    return socket.emit("error", { message: "Attempt not found" });
                }

                // Verify own attempt
                if (attempt.userId.toString() !== socket.user.userId.toString()) {
                    return socket.emit("error", { message: "Unauthorized access to this attempt" });
                }

                // Verify matching quiz
                if (attempt.quizId.toString() !== quizId.toString()) {
                    return socket.emit("error", { message: "Attempt does not match this quiz" });
                }

                // Verify valid state
                if (attempt.status !== 'IN_PROGRESS') {
                    return socket.emit("error", { message: `Attempt is already ${attempt.status.toLowerCase()}` });
                }

                // Leave old attempt room if socket had one active
                if (socket.activeAttemptId && socket.activeAttemptId !== attemptId) {
                    socket.leave(`attempt:${socket.activeAttemptId}`);
                    io.to(`admin:${socket.activeQuizId}`).emit('monitor:participant', {
                        userId: socket.user.userId,
                        status: 'DISCONNECTED',
                        attemptId: socket.activeAttemptId
                    });
                }

                socket.activeAttemptId = attemptId;
                socket.activeQuizId = quizId;

                socket.join(`attempt:${attemptId}`);
                socket.join(`quiz:${quizId}`);

                // Update connection status in DB
                attempt.connectionStatus = 'CONNECTED';
                attempt.lastSeenAt = new Date();
                await attempt.save();

                socket.emit("attempt:join_confirmed", { attemptId, quizId });

                // Broadcast join to admin room
                io.to(`admin:${quizId}`).emit("monitor:participant", {
                    userId: socket.user.userId,
                    status: 'CONNECTED',
                    attemptId
                });

            } catch (err) {
                socket.emit("error", { message: "Error joining attempt room", error: err.message });
            }
        });

        // Student explicitly leaving attempt room
        socket.on("attempt:leave", async () => {
            if (socket.activeAttemptId) {
                const attemptId = socket.activeAttemptId;
                const quizId = socket.activeQuizId;

                socket.leave(`attempt:${attemptId}`);
                if (quizId) {
                    socket.leave(`quiz:${quizId}`);
                    io.to(`admin:${quizId}`).emit("monitor:participant", {
                        userId: socket.user.userId,
                        status: 'DISCONNECTED',
                        attemptId
                    });
                }

                await Attempt.findByIdAndUpdate(attemptId, { connectionStatus: 'DISCONNECTED' }).catch(() => {});

                socket.activeAttemptId = null;
                socket.activeQuizId = null;
            }
        });

        // Safely handle disconnects
        socket.on("disconnect", async () => {
            if (socket.activeAttemptId) {
                const attemptId = socket.activeAttemptId;
                const quizId = socket.activeQuizId;

                await Attempt.findByIdAndUpdate(attemptId, { connectionStatus: 'DISCONNECTED' }).catch(() => {});

                if (quizId) {
                    io.to(`admin:${quizId}`).emit("monitor:participant", {
                        userId: socket.user.userId,
                        status: 'DISCONNECTED',
                        attemptId
                    });
                }
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        console.warn("⚠️ getIO called before initSocket. Returning null.");
        return null;
    }
    return io;
};
