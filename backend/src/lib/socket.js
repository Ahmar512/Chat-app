import {Server} from "socket.io";
import http from "http";
import express from "express";
import Call from "../models/call.model.js";

const app = express();

const server = http.createServer(app);

const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // In development, allow all origins
            if (process.env.NODE_ENV === "development" || !origin) {
                return callback(null, true);
            }
            if (
                allowedOrigins.includes(origin) ||
                origin.startsWith("http://localhost:") ||
                origin.startsWith("http://127.0.0.1:") ||
                origin.startsWith("http://192.168.") ||
                origin.startsWith("http://10.")
            ) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    }
});

export function getReceiverSocketId(userId){
    return userSocketMap[userId];
}

//used to store online users
const userSocketMap = {}; // {userId: socketId}

// Active calls tracking
const activeCalls = new Map(); // callId -> { callId, callerId, receiverId, startTime, acceptedAt, status }
const userCallMap = new Map(); // userId -> callId

const saveCallRecord = async (callData) => {
    try {
        const newCall = await Call.create(callData);
        const populatedCall = await Call.findById(newCall._id)
            .populate("callerId", "fullName profilePic email")
            .populate("receiverId", "fullName profilePic email");

        if (populatedCall) {
            const callerSocketId = userSocketMap[callData.callerId?.toString()];
            const receiverSocketId = userSocketMap[callData.receiverId?.toString()];
            if (callerSocketId) {
                io.to(callerSocketId).emit("call:history-updated", populatedCall);
            }
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("call:history-updated", populatedCall);
            }
        }
    } catch (err) {
        console.error("Error saving call record to DB:", err.message);
    }
};

const cleanupCall = (callId) => {
    const call = activeCalls.get(callId);
    if (call) {
        userCallMap.delete(call.callerId);
        userCallMap.delete(call.receiverId);
        activeCalls.delete(callId);
    }
    return call;
};

io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // Send online users to all clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // --- Voice Call Signaling ---

    // 1. Initiate Call
    socket.on("call:initiate", ({ receiverId, caller }) => {
        const receiverSocketId = userSocketMap[receiverId];

        if (!receiverSocketId) {
            socket.emit("call:unavailable", { message: "User is offline" });
            saveCallRecord({
                callerId: userId,
                receiverId,
                status: "missed",
                duration: 0,
            });
            return;
        }

        if (userCallMap.has(receiverId)) {
            socket.emit("call:busy", { message: "User is on another call" });
            saveCallRecord({
                callerId: userId,
                receiverId,
                status: "busy",
                duration: 0,
            });
            return;
        }

        const callId = `${userId}_${receiverId}_${Date.now()}`;
        const callInfo = {
            callId,
            callerId: userId,
            receiverId,
            startTime: Date.now(),
            acceptedAt: null,
            status: "ringing",
        };

        activeCalls.set(callId, callInfo);
        userCallMap.set(userId, callId);
        userCallMap.set(receiverId, callId);

        io.to(receiverSocketId).emit("call:incoming", {
            callId,
            caller,
        });
    });

    // 2. Accept Call
    socket.on("call:accept", ({ callId }) => {
        const call = activeCalls.get(callId);
        if (!call) return;

        call.status = "connected";
        call.acceptedAt = Date.now();

        const callerSocketId = userSocketMap[call.callerId];
        if (callerSocketId) {
            io.to(callerSocketId).emit("call:accepted", { callId });
        }
    });

    // 3. Reject Call
    socket.on("call:reject", ({ callId }) => {
        const call = cleanupCall(callId);
        if (!call) return;

        const callerSocketId = userSocketMap[call.callerId];
        if (callerSocketId) {
            io.to(callerSocketId).emit("call:rejected", { message: "Call was declined" });
        }

        saveCallRecord({
            callerId: call.callerId,
            receiverId: call.receiverId,
            status: "rejected",
            duration: 0,
        });
    });

    // 4. End Call
    socket.on("call:end", ({ callId }) => {
        const call = cleanupCall(callId);
        if (!call) return;

        const isCompleted = call.status === "connected" && call.acceptedAt;
        const duration = isCompleted ? Math.round((Date.now() - call.acceptedAt) / 1000) : 0;
        const status = isCompleted ? "completed" : "missed";

        const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
        const otherSocketId = userSocketMap[otherUserId];
        if (otherSocketId) {
            io.to(otherSocketId).emit("call:ended", { message: "Call ended" });
        }

        saveCallRecord({
            callerId: call.callerId,
            receiverId: call.receiverId,
            status,
            duration,
        });
    });

    // 5. WebRTC Offer Relay
    socket.on("webrtc:offer", ({ targetUserId, sdp }) => {
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:offer", { senderId: userId, sdp });
        }
    });

    // 6. WebRTC Answer Relay
    socket.on("webrtc:answer", ({ targetUserId, sdp }) => {
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:answer", { senderId: userId, sdp });
        }
    });

    // 7. WebRTC ICE Candidate Relay
    socket.on("webrtc:ice-candidate", ({ targetUserId, candidate }) => {
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:ice-candidate", { senderId: userId, candidate });
        }
    });

    // Disconnect handler
    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);

        // If user was in an active call, terminate it cleanly
        const userCurrentCallId = userCallMap.get(userId);
        if (userCurrentCallId) {
            const call = cleanupCall(userCurrentCallId);
            if (call) {
                const isCompleted = call.status === "connected" && call.acceptedAt;
                const duration = isCompleted ? Math.round((Date.now() - call.acceptedAt) / 1000) : 0;
                const status = isCompleted ? "completed" : "missed";

                const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
                const otherSocketId = userSocketMap[otherUserId];
                if (otherSocketId) {
                    io.to(otherSocketId).emit("call:ended", { message: "User disconnected" });
                }

                saveCallRecord({
                    callerId: call.callerId,
                    receiverId: call.receiverId,
                    status,
                    duration,
                });
            }
        }

        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export {io, server, app};