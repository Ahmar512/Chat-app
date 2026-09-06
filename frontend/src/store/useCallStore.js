import { create } from "zustand";
import { toast } from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { ringtone } from "../lib/ringtone";
import { axiosInstance } from "../lib/axios";

export const productionIceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:standard.relay.metered.ca:80" },
    {
        urls: "turn:standard.relay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:standard.relay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:standard.relay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
];

let rtcConfig = {
    iceServers: productionIceServers,
    iceCandidatePoolSize: 10,
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
    callType: "audio", // "audio" | "video"
    callWith: null,
    currentCallId: null,
    isMuted: false,
    isVideoOff: false,
    cameraFacingMode: "user", // "user" | "environment"
    isSpeakerOn: !isMobileDevice(), // Always false (earpiece) on mobile for audio calls, true for video/desktop
    callDuration: 0,
    localStream: null,
    remoteStream: null,
    callHistory: [],
    isCallHistoryLoading: false,

    fetchIceServers: async () => {
        try {
            const res = await axiosInstance.get("/calls/ice-servers");
            if (Array.isArray(res.data) && res.data.length > 0) {
                rtcConfig = {
                    iceServers: res.data,
                    iceCandidatePoolSize: 10,
                };
            }
        } catch (err) {
            console.log("Using default production STUN/TURN servers");
        }
    },

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
    initiateCall: async (targetUser, type = "audio") => {
        const { authUser, socket } = useAuthStore.getState();
        if (!socket || !socket.connected) {
            toast.error("Not connected to server");
            return;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("Media devices require HTTPS on mobile. Please use the HTTPS Dev Tunnel link.");
            return;
        }

        const isVideo = type === "video";

        try {
            const constraints = {
                audio: true,
                video: isVideo
                    ? {
                          facingMode: "user",
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                      }
                    : false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            set({
                callStatus: "outgoing",
                callType: type,
                callWith: targetUser,
                localStream: stream,
                isMuted: false,
                isVideoOff: false,
                cameraFacingMode: "user",
                isSpeakerOn: isVideo ? true : !isMobileDevice(),
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
                callType: type,
            });
        } catch (error) {
            console.error("Media access error:", error);
            toast.error(
                isVideo
                    ? "Could not access camera/microphone. Please check permissions."
                    : "Could not access microphone. Please check permissions."
            );
        }
    },

    acceptCall: async () => {
        const { currentCallId, callWith, callType } = get();
        const { socket } = useAuthStore.getState();

        ringtone.stop();

        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("Media devices require HTTPS on mobile. Please use the HTTPS Dev Tunnel link.");
            get().rejectCall();
            return;
        }

        const isVideo = callType === "video";

        try {
            const constraints = {
                audio: true,
                video: isVideo
                    ? {
                          facingMode: "user",
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                      }
                    : false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            set({
                callStatus: "connected",
                localStream: stream,
                isMuted: false,
                isVideoOff: false,
                cameraFacingMode: "user",
                isSpeakerOn: isVideo ? true : !isMobileDevice(),
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
            toast.error(isVideo ? "Could not access camera/microphone" : "Could not access microphone");
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

    toggleVideo: () => {
        const { localStream, isVideoOff } = get();
        if (!localStream) return;

        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length === 0) return;

        const newVideoOff = !isVideoOff;
        videoTracks.forEach((track) => {
            track.enabled = !newVideoOff;
        });

        set({ isVideoOff: newVideoOff });
    },

    switchCamera: async () => {
        const { localStream, cameraFacingMode } = get();
        if (!localStream || !peerConnection) return;

        const currentTrack = localStream.getVideoTracks()[0];
        if (!currentTrack) return;

        const newFacingMode = cameraFacingMode === "user" ? "environment" : "user";

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            if (!newVideoTrack) return;

            const sender = peerConnection.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }

            currentTrack.stop();
            localStream.removeTrack(currentTrack);
            localStream.addTrack(newVideoTrack);

            set({
                localStream: new MediaStream([...localStream.getTracks()]),
                cameraFacingMode: newFacingMode,
            });
        } catch (err) {
            console.error("Error switching camera:", err);
            toast.error("Could not switch camera");
        }
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
            callType: "audio",
            callWith: null,
            currentCallId: null,
            isMuted: false,
            isVideoOff: false,
            cameraFacingMode: "user",
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
            console.log("WebRTC ontrack received track:", event.track.kind);
            const incomingStream =
                event.streams && event.streams[0]
                    ? event.streams[0]
                    : new MediaStream([event.track]);

            set({ remoteStream: new MediaStream(incomingStream.getTracks()) });

            incomingStream.onaddtrack = () => {
                set({ remoteStream: new MediaStream(incomingStream.getTracks()) });
            };
            incomingStream.onremovetrack = () => {
                set({ remoteStream: new MediaStream(incomingStream.getTracks()) });
            };
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

        peerConnection.oniceconnectionstatechange = () => {
            console.log("WebRTC ICE Connection State:", peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === "failed") {
                console.warn("ICE Connection Failed! Retrying with ICE Restart...");
                if (typeof peerConnection.restartIce === "function") {
                    peerConnection.restartIce();
                }
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log("WebRTC Connection State:", peerConnection.connectionState);
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
        socket.on("call:incoming", ({ callId, caller, callType = "audio" }) => {
            if (get().callStatus !== "idle") {
                socket.emit("call:busy", { receiverId: caller._id });
                return;
            }

            set({
                callStatus: "incoming",
                callType: callType || "audio",
                callWith: caller,
                currentCallId: callId,
            });

            ringtone.startIncomingRingtone();
        });

        // 2. Caller receives call accepted -> create offer
        socket.on("call:accepted", async ({ callId, callType }) => {
            ringtone.stop();

            const { callWith, localStream } = get();
            set({
                callStatus: "connected",
                currentCallId: callId,
                ...(callType ? { callType } : {}),
            });

            get().startTimer();

            try {
                const pc = get().initPeerConnection(callWith._id, localStream);
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
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
