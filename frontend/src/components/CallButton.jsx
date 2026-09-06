import React from "react";
import { Phone, Video } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";

const CallButton = ({ type = "audio" }) => {
  const { selectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { callStatus, initiateCall } = useCallStore();

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);
  const isCallActive = callStatus !== "idle";
  const isVideo = type === "video";

  const handleCall = () => {
    if (!isOnline) {
      toast.error(`${selectedUser.fullName} is currently offline`);
      return;
    }
    if (isCallActive) {
      toast.error("You are already on a call");
      return;
    }
    initiateCall(selectedUser, type);
  };

  return (
    <button
      onClick={handleCall}
      disabled={!isOnline || isCallActive}
      title={
        isOnline
          ? `${isVideo ? "Video call" : "Voice call"} ${selectedUser.fullName}`
          : "User is offline"
      }
      className={`btn btn-sm btn-circle transition-all duration-200 ${
        isOnline
          ? isVideo
            ? "btn-ghost text-secondary hover:bg-secondary/10"
            : "btn-ghost text-primary hover:bg-primary/10"
          : "btn-ghost text-base-content/30 cursor-not-allowed"
      }`}
    >
      {isVideo ? (
        <Video className="size-4 sm:size-5" />
      ) : (
        <Phone className="size-4 sm:size-5" />
      )}
    </button>
  );
};

export default CallButton;
