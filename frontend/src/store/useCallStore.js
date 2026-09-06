import { create } from "zustand";
import { toast } from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { ringtone } from "../lib/ringtone";
import { axiosInstance } from "../lib/axios";

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

export const isMobileDevice = () =>
    typeof navigator !== "undefined" &&
    (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== "undefined" && (window.innerWidth < 768 || window.matchMedia("(max-width: 768px)").matches)));

let peerConnection = null;
let timerInterval = null;
let iceCandidatesQueue = [];

export const useCallStore = create((set, get) => ({
    callStatus: "idle", // "idle" | "outgoing" | "incoming" | "connected"
    callWith: null,
    currentCallId: null,
    isMuted: false,
    isSpeakerOn: !isMobileDevice(), // Always false (earpiece) on mobile, true on desktop
    callDuration: 0,
    localStream: null,
    remoteStream: null,
    callHistory: [],
    isCallHistoryLoading: false,

    getCallHistory: async () => {
        set({ isCallHistoryLoading: true });
        try {
            const res = await axiosInstance.get("/calls/history");
            set({ callHistory: res.data });
        } catch (error) {
            console.error("Error fetching call history:", error);
        } finally {
            set({ isCallHistoryLoading: false });
        }
    },

    // ----------------------------------------------------
    // Call Actions
    // ----------------------------------------------------
    initiateCall: async (targetUser) => {
        const { authUser, socket } = useAuthStore.getState();
        if (!socket || !socket.connected) {
            toast.error("Not connected to server");
            return;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("Microphone requires HTTPS on mobile. Please use the HTTPS Dev Tunnel link.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });

            set({
                callStatus: "outgoing",
                callWith: targetUser,
                localStream: stream,
                isMuted: false,
                isSpeakerOn: !isMobileDevice(),
                callDuration: 0,
            });

            ringtone.startOutgoingTone();

            socket.emit("call:initiate", {
                receiverId: targetUser._id,
                caller: {
                    _id: authUser._id,
                    fullName: authUser.fullName,
                    profilePic: authUser.profilePic,
                },
            });
        } catch (error) {
            console.error("Microphone access error:", error);
            toast.error("Could not access microphone. Please check permissions.");
        }
    },

    acceptCall: async () => {
        const { currentCallId, callWith } = get();
        const { socket } = useAuthStore.getState();

        ringtone.stop();

        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("Microphone requires HTTPS on mobile. Please use the HTTPS Dev Tunnel link.");
            get().rejectCall();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });

            set({
                callStatus: "connected",
                localStream: stream,
                isMuted: false,
                isSpeakerOn: !isMobileDevice(),
                callDuration: 0,
            });

            // Start call duration timer
            get().startTimer();

            // Create WebRTC peer connection
            get().initPeerConnection(callWith._id, stream);

            if (socket) {
                socket.emit("call:accept", { callId: currentCallId });
            }
        } catch (error) {
            console.error("Error accepting call:", error);
            toast.error("Could not access microphone");
            get().rejectCall();
        }
    },

    rejectCall: () => {
        const { currentCallId } = get();
        const { socket } = useAuthStore.getState();

        ringtone.stop();

        if (socket && currentCallId) {
            socket.emit("call:reject", { callId: currentCallId });
        }

        get().resetCallState();
    },

    endCall: () => {
        const { currentCallId } = get();
        const { socket } = useAuthStore.getState();

        ringtone.stop();

        if (socket && currentCallId) {
            socket.emit("call:end", { callId: currentCallId });
        }

        get().resetCallState();
    },

    toggleMute: () => {
        const { localStream, isMuted } = get();
        if (!localStream) return;

        const newMutedState = !isMuted;
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = !newMutedState;
        });

        set({ isMuted: newMutedState });
    },

    toggleSpeaker: () => {
        set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
    },

    startTimer: () => {
        if (timerInterval) clearInterval(timerInterval);
        set({ callDuration: 0 });
        timerInterval = setInterval(() => {
            set((state) => ({ callDuration: state.callDuration + 1 }));
        }, 1000);
    },

    resetCallState: () => {
        ringtone.stop();

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        const { localStream } = get();
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        iceCandidatesQueue = [];

        set({
            callStatus: "idle",
            callWith: null,
            currentCallId: null,
            isMuted: false,
            isSpeakerOn: !isMobileDevice(),
            callDuration: 0,
            localStream: null,
            remoteStream: null,
        });
    },

    // ----------------------------------------------------
    // WebRTC Peer Connection Handlers
    // ----------------------------------------------------
    initPeerConnection: (targetUserId, stream) => {
        if (peerConnection) {
            peerConnection.close();
        }

        peerConnection = new RTCPeerConnection(rtcConfig);
        iceCandidatesQueue = [];

        // Add local tracks
        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                set({ remoteStream: event.streams[0] });
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const { socket } = useAuthStore.getState();
                if (socket) {
                    socket.emit("webrtc:ice-candidate", {
                        targetUserId,
                        candidate: event.candidate,
                    });
                }
            }
        };

        peerConnection.onconnectionstatechange = () => {
            if (
                peerConnection.connectionState === "disconnected" ||
                peerConnection.connectionState === "failed" ||
                peerConnection.connectionState === "closed"
            ) {
                get().resetCallState();
            }
        };

        return peerConnection;
    },

    // ----------------------------------------------------
    // Socket Signal Listeners
    // ----------------------------------------------------
    setupCallListeners: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // Clean any existing listeners first
        get().cleanupCallListeners();

        // 1. Incoming Call
        socket.on("call:incoming", ({ callId, caller }) => {
            if (get().callStatus !== "idle") {
                socket.emit("call:busy", { receiverId: caller._id });
                return;
            }

            set({
                callStatus: "incoming",
                callWith: caller,
                currentCallId: callId,
            });

            ringtone.startIncomingRingtone();
        });

        // 2. Caller receives call accepted -> create offer
        socket.on("call:accepted", async ({ callId }) => {
            ringtone.stop();

            const { callWith, localStream } = get();
            set({
                callStatus: "connected",
                currentCallId: callId,
            });

            get().startTimer();

            try {
                const pc = get().initPeerConnection(callWith._id, localStream);
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                });
                await pc.setLocalDescription(offer);

                socket.emit("webrtc:offer", {
                    targetUserId: callWith._id,
                    sdp: offer,
                });
            } catch (err) {
                console.error("Error creating WebRTC offer:", err);
                toast.error("Failed to establish call connection");
                get().endCall();
            }
        });

        // 3. Receiver receives WebRTC Offer -> set remote, create answer
        socket.on("webrtc:offer", async ({ senderId, sdp }) => {
            try {
                let pc = peerConnection;
                if (!pc) {
                    const { localStream } = get();
                    pc = get().initPeerConnection(senderId, localStream);
                }

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                // Process any queued candidates
                while (iceCandidatesQueue.length > 0) {
                    const candidate = iceCandidatesQueue.shift();
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit("webrtc:answer", {
                    targetUserId: senderId,
                    sdp: answer,
                });
            } catch (err) {
                console.error("Error handling WebRTC offer:", err);
            }
        });

        // 4. Caller receives WebRTC Answer
        socket.on("webrtc:answer", async ({ sdp }) => {
            try {
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

                    // Process queued ICE candidates
                    while (iceCandidatesQueue.length > 0) {
                        const candidate = iceCandidatesQueue.shift();
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
            } catch (err) {
                console.error("Error handling WebRTC answer:", err);
            }
        });

        // 5. ICE Candidate
        socket.on("webrtc:ice-candidate", async ({ candidate }) => {
            try {
                if (peerConnection && peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    iceCandidatesQueue.push(candidate);
                }
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        });

        // 6. Call Rejected
        socket.on("call:rejected", ({ message }) => {
            toast.error(message || "Call was declined");
            get().resetCallState();
        });

        // 7. Call Busy
        socket.on("call:busy", ({ message }) => {
            toast.error(message || "User is on another call");
            get().resetCallState();
        });

        // 8. Call Unavailable (User offline)
        socket.on("call:unavailable", ({ message }) => {
            toast.error(message || "User is currently offline");
            get().resetCallState();
        });

        // 9. Call Ended by other party
        socket.on("call:ended", ({ message }) => {
            toast(message || "Call ended", { icon: "📞" });
            get().resetCallState();
        });

        // 10. Real-time call history update
        socket.on("call:history-updated", (newCallRecord) => {
            set((state) => ({
                callHistory: [
                    newCallRecord,
                    ...state.callHistory.filter((c) => c._id !== newCallRecord._id),
                ],
            }));
        });
    },

    cleanupCallListeners: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("call:incoming");
        socket.off("call:accepted");
        socket.off("call:rejected");
        socket.off("call:busy");
        socket.off("call:unavailable");
        socket.off("call:ended");
        socket.off("call:history-updated");
        socket.off("webrtc:offer");
        socket.off("webrtc:answer");
        socket.off("webrtc:ice-candidate");
    },
}));
