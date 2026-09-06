import {Server} from "socket.io";
import http from "http";
import express from "express";
import Call from "../models/call.model.js";

const app = express();

const server = http.createServer(app);

const allowedOrigins = [
    process.env.CLIENT_URL?.replace(/\/$/, ""),
    process.env.FRONTEND_URL?.replace(/\/$/, ""),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl) or development
            if (!origin || process.env.NODE_ENV === "development") {
                return callback(null, true);
            }
            const cleanOrigin = origin.replace(/\/$/, "");
            if (
                allowedOrigins.includes(cleanOrigin) ||
                cleanOrigin.endsWith(".vercel.app") ||
                cleanOrigin.includes(".devtunnels.ms") ||
                cleanOrigin.startsWith("http://localhost:") ||
                cleanOrigin.startsWith("http://127.0.0.1:") ||
                cleanOrigin.startsWith("http://192.168.") ||
                cleanOrigin.startsWith("http://10.")
            ) {
                return callback(null, true);
            }
            // Fallback: allow origin with credentials
            return callback(null, true);
        },
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// Map of userId -> Set of socketIds (handles multi-tab, page refreshes, and reconnection cleanly)
const userSocketMap = new Map(); // userId -> Set<socketId>
const socketUserMap = new Map(); // socketId -> userId

export function getReceiverSocketId(userId) {
    if (!userId) return null;
    const sockets = userSocketMap.get(userId.toString());
    if (!sockets || sockets.size === 0) return null;
    // Return the latest active socket ID
    return Array.from(sockets).pop();
}

export function isUserOnline(userId) {
    if (!userId) return false;
    const sockets = userSocketMap.get(userId.toString());
    return Boolean(sockets && sockets.size > 0);
}

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
            const callerIdStr = callData.callerId?.toString();
            const receiverIdStr = callData.receiverId?.toString();
            if (callerIdStr) io.to(callerIdStr).emit("call:history-updated", populatedCall);
            if (receiverIdStr) io.to(receiverIdStr).emit("call:history-updated", populatedCall);
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
    if (userId) {
        if (!userSocketMap.has(userId)) {
            userSocketMap.set(userId, new Set());
        }
        userSocketMap.get(userId).add(socket.id);
        socketUserMap.set(socket.id, userId);

        // Join room named by userId so events can target all sockets of this user
        socket.join(userId);
    }

    // Send online users to all clients
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

    // Client can request fresh online list on focus/reconnect
    socket.on("requestOnlineUsers", () => {
        socket.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });

    // --- Voice & Video Call Signaling ---

    // 1. Initiate Call
    socket.on("call:initiate", ({ receiverId, caller, callType = "audio" }) => {
        const receiverSocketId = getReceiverSocketId(receiverId);

        if (!receiverSocketId) {
            socket.emit("call:unavailable", { message: "User is offline" });
            saveCallRecord({
                callerId: userId,
                receiverId,
                status: "missed",
                callType,
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
                callType,
                duration: 0,
            });
            return;
        }

        const callId = `${userId}_${receiverId}_${Date.now()}`;
        const callInfo = {
            callId,
            callerId: userId,
            receiverId,
            callType,
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
            callType,
        });
    });

    // 2. Accept Call
    socket.on("call:accept", ({ callId }) => {
        const call = activeCalls.get(callId);
        if (!call) return;

        call.status = "connected";
        call.acceptedAt = Date.now();

        const callerSocketId = getReceiverSocketId(call.callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit("call:accepted", { callId, callType: call.callType });
        }
    });

    // 3. Reject Call
    socket.on("call:reject", ({ callId }) => {
        const call = cleanupCall(callId);
        if (!call) return;

        const callerSocketId = getReceiverSocketId(call.callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit("call:rejected", { message: "Call was declined" });
        }

        saveCallRecord({
            callerId: call.callerId,
            receiverId: call.receiverId,
            status: "rejected",
            callType: call.callType || "audio",
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
        const otherSocketId = getReceiverSocketId(otherUserId);
        if (otherSocketId) {
            io.to(otherSocketId).emit("call:ended", { message: "Call ended" });
        }

        saveCallRecord({
            callerId: call.callerId,
            receiverId: call.receiverId,
            status,
            callType: call.callType || "audio",
            duration,
        });
    });

    // 5. WebRTC Offer Relay
    socket.on("webrtc:offer", ({ targetUserId, sdp }) => {
        const targetSocketId = getReceiverSocketId(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:offer", { senderId: userId, sdp });
        }
    });

    // 6. WebRTC Answer Relay
    socket.on("webrtc:answer", ({ targetUserId, sdp }) => {
        const targetSocketId = getReceiverSocketId(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:answer", { senderId: userId, sdp });
        }
    });

    // 7. WebRTC ICE Candidate Relay
    socket.on("webrtc:ice-candidate", ({ targetUserId, candidate }) => {
        const targetSocketId = getReceiverSocketId(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:ice-candidate", { senderId: userId, candidate });
        }
    });

    // Disconnect handler
    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);

        const mappedUserId = socketUserMap.get(socket.id) || userId;

        // If user was in an active call, terminate it cleanly
        const userCurrentCallId = userCallMap.get(mappedUserId);
        if (userCurrentCallId) {
            const call = cleanupCall(userCurrentCallId);
            if (call) {
                const isCompleted = call.status === "connected" && call.acceptedAt;
                const duration = isCompleted ? Math.round((Date.now() - call.acceptedAt) / 1000) : 0;
                const status = isCompleted ? "completed" : "missed";

                const otherUserId = call.callerId === mappedUserId ? call.receiverId : call.callerId;
                const otherSocketId = getReceiverSocketId(otherUserId);
                if (otherSocketId) {
                    io.to(otherSocketId).emit("call:ended", { message: "User disconnected" });
                }

                saveCallRecord({
                    callerId: call.callerId,
                    receiverId: call.receiverId,
                    status,
                    callType: call.callType || "audio",
                    duration,
                });
            }
        }

        // Clean up socket mapping without erroneously removing the user if other sockets remain
        if (mappedUserId && userSocketMap.has(mappedUserId)) {
            const sockets = userSocketMap.get(mappedUserId);
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                userSocketMap.delete(mappedUserId);
            }
        }
        socketUserMap.delete(socket.id);

        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });
});

export {io, server, app};