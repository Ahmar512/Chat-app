import React, { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Smartphone,
  Video,
  VideoOff,
  SwitchCamera,
} from "lucide-react";
import { useCallStore, isMobileDevice } from "../store/useCallStore";

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const CallOverlay = () => {
  const {
    callStatus,
    callType,
    callWith,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    callDuration,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleSpeaker,
  } = useCallStore();

  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  const [isNearEar, setIsNearEar] = useState(false);
  const isMobile = isMobileDevice();
  const isVideoCall = callType === "video";

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoCall, callStatus]);

  // Attach remote stream to remote video / audio elements
  useEffect(() => {
    if (isVideoCall) {
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.log("Remote video autoplay:", err);
        });
      }
    } else {
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) => {
          console.log("Remote audio autoplay:", err);
        });
      }
    }
  }, [remoteStream, isVideoCall, callStatus]);

  // Handle Speaker vs Earpiece audio routing (for audio calls)
  useEffect(() => {
    const targetElement = isVideoCall ? remoteVideoRef.current : remoteAudioRef.current;
    if (!targetElement) return;

    const updateAudioSink = async () => {
      try {
        if (
          typeof targetElement.setSinkId === "function" &&
          navigator.mediaDevices?.enumerateDevices
        ) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

          if (audioOutputs.length > 0) {
            let target = null;
            if (isSpeakerOn || isVideoCall) {
              target =
                audioOutputs.find(
                  (d) =>
                    d.label.toLowerCase().includes("speaker") ||
                    d.label.toLowerCase().includes("speakerphone") ||
                    d.deviceId === "default"
                ) || audioOutputs[0];
            } else {
              target = audioOutputs.find(
                (d) =>
                  d.label.toLowerCase().includes("earpiece") ||
                  d.label.toLowerCase().includes("receiver") ||
                  d.label.toLowerCase().includes("telephony") ||
                  d.label.toLowerCase().includes("internal")
              );
              if (!target && audioOutputs.length > 1) {
                target =
                  audioOutputs.find((d) => d.deviceId !== "default") || audioOutputs[1];
              }
            }

            if (target && target.deviceId) {
              await targetElement.setSinkId(target.deviceId);
            }
          }
        }

        // Adjust volume
        targetElement.volume = isSpeakerOn || isVideoCall ? 1.0 : 0.25;
      } catch (err) {
        console.log("Audio routing sink adjustment:", err);
      }
    };

    updateAudioSink();
  }, [isSpeakerOn, remoteStream, isVideoCall]);

  // Proximity Sensor Detection for Audio Calls in Earpiece mode
  useEffect(() => {
    if (callStatus !== "connected" || isVideoCall || isSpeakerOn) {
      setIsNearEar(false);
      return;
    }

    const cleanupSensors = [];

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

    const handleUserProximity = (event) => {
      setIsNearEar(Boolean(event.near));
    };
    window.addEventListener("userproximity", handleUserProximity);
    cleanupSensors.push(() => window.removeEventListener("userproximity", handleUserProximity));

    return () => {
      cleanupSensors.forEach((cleanup) => cleanup());
      setIsNearEar(false);
    };
  }, [callStatus, isSpeakerOn, isVideoCall]);

  if (callStatus === "idle" || !callWith) return null;

  // ----------------------------------------------------
  // VIDEO CALL UI
  // ----------------------------------------------------
  if (isVideoCall) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-fade-in">
        {/* Remote Video (Main background view) */}
        <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">
          {callStatus === "connected" && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-6">
                <div className="size-28 sm:size-36 rounded-full overflow-hidden ring-4 ring-primary/80 animate-pulse">
                  <img
                    src={callWith.profilePic || "/avatar.png"}
                    alt={callWith.fullName}
                    className="size-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping pointer-events-none" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {callWith.fullName}
              </h3>
              <p className="text-sm text-primary font-medium flex items-center gap-2">
                <Video className="size-4 animate-bounce" />
                <span>
                  {callStatus === "incoming"
                    ? "Incoming video call..."
                    : callStatus === "outgoing"
                    ? "Calling with video..."
                    : "Connecting video..."}
                </span>
              </p>
            </div>
          )}

          {/* Floating Local Video Picture-in-Picture (PiP) */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <div className="w-24 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-zinc-900 relative">
              {isVideoOff ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-zinc-900 text-zinc-400">
                  <VideoOff className="size-5 mb-1 text-zinc-500" />
                  <span className="text-[10px]">Camera off</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              )}
            </div>
          </div>

          {/* Top Bar (Call info & duration) */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-3 bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 text-white">
            <div className="size-8 rounded-full overflow-hidden">
              <img
                src={callWith.profilePic || "/avatar.png"}
                alt={callWith.fullName}
                className="size-full object-cover"
              />
            </div>
            <div className="text-left">
              <div className="font-semibold text-xs sm:text-sm leading-tight">
                {callWith.fullName}
              </div>
              <div className="text-[11px] text-white/70">
                {callStatus === "connected"
                  ? formatDuration(callDuration)
                  : callStatus === "incoming"
                  ? "Incoming..."
                  : "Calling..."}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="absolute bottom-6 inset-x-0 z-30 flex items-center justify-center p-4 pointer-events-none">
          <div className="flex items-center gap-3 sm:gap-5 bg-black/60 backdrop-blur-lg px-6 py-3.5 rounded-full border border-white/15 shadow-2xl pointer-events-auto">
            {/* Incoming Controls */}
            {callStatus === "incoming" && (
              <>
                <button
                  onClick={rejectCall}
                  className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white border-none shadow-lg shadow-rose-600/40 hover:scale-105 transition-transform"
                  title="Decline call"
                >
                  <PhoneOff className="size-6" />
                </button>
                <button
                  onClick={acceptCall}
                  className="btn btn-circle btn-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-600/40 hover:scale-105 transition-transform animate-bounce"
                  title="Accept video call"
                >
                  <Video className="size-6" />
                </button>
              </>
            )}

            {/* Outgoing Controls */}
            {callStatus === "outgoing" && (
              <button
                onClick={endCall}
                className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white border-none shadow-lg shadow-rose-600/40 hover:scale-105 transition-transform"
                title="Cancel call"
              >
                <PhoneOff className="size-6" />
              </button>
            )}

            {/* Connected Controls */}
            {callStatus === "connected" && (
              <>
                {/* Mic Mute */}
                <button
                  onClick={toggleMute}
                  className={`btn btn-circle btn-md transition-transform hover:scale-105 ${
                    isMuted
                      ? "bg-amber-500 text-white border-none"
                      : "bg-white/20 text-white hover:bg-white/30 border-none"
                  }`}
                  title={isMuted ? "Unmute mic" : "Mute mic"}
                >
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>

                {/* Camera Toggle (On/Off) */}
                <button
                  onClick={toggleVideo}
                  className={`btn btn-circle btn-md transition-transform hover:scale-105 ${
                    isVideoOff
                      ? "bg-amber-500 text-white border-none"
                      : "bg-white/20 text-white hover:bg-white/30 border-none"
                  }`}
                  title={isVideoOff ? "Turn camera on" : "Turn camera off"}
                >
                  {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>

                {/* Switch Camera (Mobile only) */}
                {isMobile && (
                  <button
                    onClick={switchCamera}
                    className="btn btn-circle btn-md bg-white/20 text-white hover:bg-white/30 border-none transition-transform hover:scale-105"
                    title="Flip camera"
                  >
                    <SwitchCamera className="size-5" />
                  </button>
                )}

                {/* End Video Call Button */}
                <button
                  onClick={endCall}
                  className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white border-none shadow-lg shadow-rose-600/40 hover:scale-105 transition-transform"
                  title="End video call"
                >
                  <PhoneOff className="size-6" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // AUDIO CALL UI (Existing Clean Voice Call Interface)
  // ----------------------------------------------------
  return (
    <>
      {/* Fullscreen Proximity Blackout for Earpiece mode */}
      {callStatus === "connected" && !isSpeakerOn && isNearEar && (
        <div
          className="fixed inset-0 z-[9999] bg-black cursor-none select-none flex flex-col items-center justify-center pointer-events-auto"
          style={{ backgroundColor: "#000000", touchAction: "none" }}
          onClick={() => setIsNearEar(false)}
          title="Tap to wake screen"
        >
          <span className="opacity-0">Earpiece active</span>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
        {/* Hidden audio element for receiving remote audio */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="relative w-full max-w-sm rounded-3xl bg-base-100/90 border border-base-content/10 shadow-2xl p-8 flex flex-col items-center text-center overflow-hidden">
          {/* Background decorative glow */}
          <div className="absolute -top-12 -left-12 size-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 size-36 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar */}
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

            {callStatus !== "connected" && (
              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping pointer-events-none" />
            )}
          </div>

          {/* User Info & Status */}
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
                <span>Incoming audio call...</span>
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

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 w-full">
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

            {callStatus === "outgoing" && (
              <button
                onClick={endCall}
                className="btn btn-circle btn-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border-none transition-transform hover:scale-105"
                title="End call"
              >
                <PhoneOff className="size-6" />
              </button>
            )}

            {callStatus === "connected" && (
              <>
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
