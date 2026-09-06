import React, { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Smartphone } from "lucide-react";
import { useCallStore, isMobileDevice } from "../store/useCallStore";

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const CallOverlay = () => {
    const {
        callStatus,
        callWith,
        isMuted,
        isSpeakerOn,
        callDuration,
        remoteStream,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
    } = useCallStore();

    const remoteAudioRef = useRef(null);
    const [isNearEar, setIsNearEar] = useState(false);
    const isMobile = isMobileDevice();

    // Attach remote stream to audio element when connected
    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch((err) => {
                console.log("Audio autoplay error:", err);
            });
        }
    }, [remoteStream]);

    // Handle Speaker vs Earpiece audio routing
    useEffect(() => {
        const updateAudioSink = async () => {
            if (!remoteAudioRef.current) return;
            try {
                // If setSinkId is supported (Chromium / Chrome Android)
                if (
                    typeof remoteAudioRef.current.setSinkId === "function" &&
                    navigator.mediaDevices?.enumerateDevices
                ) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

                    if (audioOutputs.length > 0) {
                        let target = null;
                        if (isSpeakerOn) {
                            // Speakerphone / Loudspeaker
                            target =
                                audioOutputs.find(
                                    (d) =>
                                        d.label.toLowerCase().includes("speaker") ||
                                        d.label.toLowerCase().includes("speakerphone") ||
                                        d.deviceId === "default"
                                ) || audioOutputs[0];
                        } else {
                            // Internal Earpiece / Receiver
                            target = audioOutputs.find(
                                (d) =>
                                    d.label.toLowerCase().includes("earpiece") ||
                                    d.label.toLowerCase().includes("receiver") ||
                                    d.label.toLowerCase().includes("telephony") ||
                                    d.label.toLowerCase().includes("internal")
                            );
                            if (!target && audioOutputs.length > 1) {
                                target =
                                    audioOutputs.find((d) => d.deviceId !== "default") ||
                                    audioOutputs[1];
                            }
                        }

                        if (target && target.deviceId) {
                            await remoteAudioRef.current.setSinkId(target.deviceId);
                            console.log("Audio output routed to:", target.label || target.deviceId);
                        }
                    }
                }

                // Adjust volume level between speakerphone (100%) and earpiece (25% to be soft and safe for the ear)
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.25;
                }
            } catch (err) {
                console.log("Audio routing sink adjustment:", err);
            }
        };

        updateAudioSink();
    }, [isSpeakerOn, remoteStream]);

    // Proximity Sensor Detection for Earpiece mode (blacks out screen when lifted to ear)
    useEffect(() => {
        // Only active during a connected call when speaker is OFF (earpiece mode)
        if (callStatus !== "connected" || isSpeakerOn) {
            setIsNearEar(false);
            return;
        }

        const cleanupSensors = [];

        // 1. W3C Generic Sensor API (ProximitySensor)
        if ("ProximitySensor" in window) {
            try {
                const sensor = new window.ProximitySensor();
                sensor.addEventListener("reading", () => {
                    setIsNearEar(Boolean(sensor.near));
                });
                sensor.addEventListener("error", () => {});
                sensor.start();
                cleanupSensors.push(() => sensor.stop());
            } catch (err) {
                console.log("ProximitySensor error:", err);
            }
        }

        // 2. Legacy userproximity event
        const handleUserProximity = (event) => {
            setIsNearEar(Boolean(event.near));
        };
        window.addEventListener("userproximity", handleUserProximity);
        cleanupSensors.push(() => window.removeEventListener("userproximity", handleUserProximity));

        // 3. Legacy deviceproximity event
        const handleDeviceProximity = (event) => {
            const min = event.min || 0;
            setIsNearEar(event.value <= min + 2);
        };
        window.addEventListener("deviceproximity", handleDeviceProximity);
        cleanupSensors.push(() => window.removeEventListener("deviceproximity", handleDeviceProximity));

        // 4. AmbientLightSensor (ear covering top sensor drops lux to < 2)
        if ("AmbientLightSensor" in window) {
            try {
                const lightSensor = new window.AmbientLightSensor();
                lightSensor.addEventListener("reading", () => {
                    if (lightSensor.illuminance < 2) {
                        setIsNearEar(true);
                    } else if (lightSensor.illuminance > 5) {
                        setIsNearEar(false);
                    }
                });
                lightSensor.addEventListener("error", () => {});
                lightSensor.start();
                cleanupSensors.push(() => lightSensor.stop());
            } catch (err) {
                console.log("AmbientLightSensor error:", err);
            }
        }

        return () => {
            cleanupSensors.forEach((cleanup) => cleanup());
            setIsNearEar(false);
        };
    }, [callStatus, isSpeakerOn]);

    if (callStatus === "idle" || !callWith) return null;

    return (
        <>
            {/* Fullscreen Proximity Blackout: Pitch black screen when phone is placed near ear in earpiece mode */}
            {callStatus === "connected" && !isSpeakerOn && isNearEar && (
                <div
                    className="fixed inset-0 z-[9999] bg-black cursor-none select-none flex flex-col items-center justify-center pointer-events-auto transition-opacity duration-200"
                    style={{ backgroundColor: "#000000", touchAction: "none" }}
                    onClick={() => setIsNearEar(false)}
                    title="Tap to wake screen"
                >
                    {/* Screen is completely blacked out to prevent accidental touches by face or ear */}
                    <span className="opacity-0">Earpiece active</span>
                </div>
            )}

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                {/* Hidden audio element for receiving remote WebRTC audio */}
                <audio ref={remoteAudioRef} autoPlay playsInline />

                <div className="relative w-full max-w-sm rounded-3xl bg-base-100/90 border border-base-content/10 shadow-2xl p-8 flex flex-col items-center text-center overflow-hidden">
                    {/* Background decorative glow */}
                    <div className="absolute -top-12 -left-12 size-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-12 -right-12 size-36 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Avatar with dynamic pulsing animations */}
                    <div className="relative mb-6">
                        <div
                            className={`size-28 sm:size-32 rounded-full overflow-hidden ring-4 transition-all duration-500 ${
                                callStatus === "connected"
                                    ? "ring-emerald-500/80 shadow-lg shadow-emerald-500/20"
                                    : callStatus === "incoming"
                                    ? "ring-emerald-400 animate-pulse"
                                    : "ring-primary/80 animate-pulse"
                            }`}
                        >
                            <img
                                src={callWith.profilePic || "/avatar.png"}
                                alt={callWith.fullName}
                                className="size-full object-cover"
                            />
                        </div>

                        {/* Animated ringing waves for incoming / outgoing */}
                        {callStatus !== "connected" && (
                            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping pointer-events-none" />
                        )}
                    </div>

                    {/* User Info & Call Status */}
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-base-content">
                        {callWith.fullName}
                    </h3>

                    <div className="mb-6">
                        {callStatus === "outgoing" && (
                            <p className="text-sm font-medium text-primary flex items-center gap-1.5 animate-pulse">
                                <span>Calling...</span>
                            </p>
                        )}
                        {callStatus === "incoming" && (
                            <p className="text-sm font-medium text-emerald-500 flex items-center gap-1.5 animate-bounce">
                                <span>Incoming voice call...</span>
                            </p>
                        )}
                        {callStatus === "connected" && (
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs uppercase tracking-widest text-emerald-500 font-semibold">
                                    Connected
                                </span>
                                <span className="font-mono text-lg font-bold text-base-content/80">
                                    {formatDuration(callDuration)}
                                </span>
                                {/* Audio mode badge (mobile only) */}
                                {isMobile && (
                                    <span className="text-xs text-base-content/60 flex items-center gap-1 mt-1">
                                        {isSpeakerOn ? (
                                            <span className="text-emerald-500 font-medium">🔊 Speakerphone</span>
                                        ) : (
                                            <span>📱 Earpiece (Auto-blackout near ear)</span>
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Call Control Buttons */}
                    <div className="flex items-center justify-center gap-5 w-full">
                        {/* INCOMING STATE: Accept (Green) and Decline (Red) */}
                        {callStatus === "incoming" && (
                            <>
                                <button
                                    onClick={rejectCall}
                                    className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border-none transition-transform hover:scale-105"
                                    title="Decline call"
                                >
                                    <PhoneOff className="size-6" />
                                </button>
                                <button
                                    onClick={acceptCall}
                                    className="btn btn-circle btn-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 border-none transition-transform hover:scale-105 animate-bounce"
                                    title="Accept call"
                                >
                                    <Phone className="size-6" />
                                </button>
                            </>
                        )}

                        {/* OUTGOING STATE: End/Cancel (Red) */}
                        {callStatus === "outgoing" && (
                            <button
                                onClick={endCall}
                                className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border-none transition-transform hover:scale-105"
                                title="End call"
                            >
                                <PhoneOff className="size-6" />
                            </button>
                        )}

                        {/* CONNECTED STATE: Mute Toggle + Speaker Toggle + End Call */}
                        {callStatus === "connected" && (
                            <>
                                {/* Mute Button */}
                                <button
                                    onClick={toggleMute}
                                    className={`btn btn-circle btn-md transition-transform hover:scale-105 ${
                                        isMuted
                                            ? "bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30"
                                            : "bg-base-200 text-base-content hover:bg-base-300"
                                    }`}
                                    title={isMuted ? "Unmute microphone" : "Mute microphone"}
                                >
                                    {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                                </button>

                                {/* Speaker / Earpiece Toggle Button (Mobile Only) */}
                                {isMobile && (
                                    <button
                                        onClick={toggleSpeaker}
                                        className={`btn btn-circle btn-md transition-transform hover:scale-105 ${
                                            isSpeakerOn
                                                ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/30"
                                                : "bg-base-200 text-base-content hover:bg-base-300"
                                        }`}
                                        title={
                                            isSpeakerOn
                                                ? "Speakerphone ON (Click for Earpiece)"
                                                : "Earpiece Mode (Click for Speakerphone)"
                                        }
                                    >
                                        {isSpeakerOn ? (
                                            <Volume2 className="size-5" />
                                        ) : (
                                            <Smartphone className="size-5" />
                                        )}
                                    </button>
                                )}

                                {/* End Call Button */}
                                <button
                                    onClick={endCall}
                                    className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border-none transition-transform hover:scale-105"
                                    title="End call"
                                >
                                    <PhoneOff className="size-6" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CallOverlay;

