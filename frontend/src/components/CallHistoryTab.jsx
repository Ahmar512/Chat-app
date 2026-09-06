import React, { useEffect } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Clock,
  RotateCw,
} from "lucide-react";

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
};

const formatCallTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
};

const CallHistoryTab = () => {
  const { callHistory, isCallHistoryLoading, getCallHistory, initiateCall } =
    useCallStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { setSelectedUser } = useChatStore();

  useEffect(() => {
    getCallHistory();
  }, [getCallHistory]);

  const handleRowClick = (user) => {
    if (user && user._id) {
      setSelectedUser(user);
    }
  };

  const handleCallBack = (e, user) => {
    e.stopPropagation();
    if (user && user._id) {
      initiateCall(user);
    }
  };

  if (isCallHistoryLoading && callHistory.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="size-12 rounded-full bg-base-300 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-base-300 rounded w-1/2" />
              <div className="h-3 bg-base-300 rounded w-1/3" />
            </div>
            <div className="size-8 rounded-full bg-base-300" />
          </div>
        ))}
      </div>
    );
  }

  if (!callHistory || callHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-zinc-500">
        <div className="size-14 rounded-full bg-base-200 flex items-center justify-center mb-3">
          <Phone className="size-7 text-zinc-400" />
        </div>
        <h4 className="font-semibold text-base text-base-content mb-1">
          No Call History
        </h4>
        <p className="text-xs text-zinc-400 max-w-[200px]">
          Recent voice calls with your contacts will be displayed here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto w-full py-1">
      <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-zinc-400 tracking-wide uppercase border-b border-base-200">
        <span>Recent Calls</span>
        <button
          onClick={() => getCallHistory()}
          className="hover:text-primary transition-colors flex items-center gap-1 normal-case"
          title="Refresh"
        >
          <RotateCw className="size-3.5" />
        </button>
      </div>

      <div className="divide-y divide-base-200/50">
        {callHistory.map((call) => {
          const isOutgoing = call.callerId?._id === authUser?._id;
          const otherUser = isOutgoing ? call.receiverId : call.callerId;

          if (!otherUser) return null;

          const isOnline = onlineUsers.includes(otherUser._id);
          const isCompleted = call.status === "completed";
          const isMissed = call.status === "missed";
          const isRejected = call.status === "rejected";
          const isBusy = call.status === "busy";

          // Icon & styling based on direction & status
          let StatusIcon = PhoneOutgoing;
          let iconColor = "text-zinc-400";
          let statusLabel = "";

          if (isOutgoing) {
            StatusIcon = PhoneOutgoing;
            if (isCompleted) {
              iconColor = "text-emerald-500";
              statusLabel = `Outgoing • ${formatDuration(call.duration)}`;
            } else if (isBusy) {
              iconColor = "text-amber-500";
              statusLabel = "User busy";
            } else if (isRejected) {
              iconColor = "text-red-400";
              statusLabel = "Declined";
            } else {
              iconColor = "text-zinc-400";
              statusLabel = "Cancelled";
            }
          } else {
            // Incoming
            if (isCompleted) {
              StatusIcon = PhoneIncoming;
              iconColor = "text-emerald-500";
              statusLabel = `Incoming • ${formatDuration(call.duration)}`;
            } else if (isMissed) {
              StatusIcon = PhoneMissed;
              iconColor = "text-red-500";
              statusLabel = "Missed call";
            } else if (isRejected) {
              StatusIcon = PhoneOff;
              iconColor = "text-red-400";
              statusLabel = "Declined";
            } else if (isBusy) {
              StatusIcon = PhoneOff;
              iconColor = "text-amber-500";
              statusLabel = "Busy";
            }
          }

          return (
            <div
              key={call._id}
              onClick={() => handleRowClick(otherUser)}
              className="w-full p-3 flex items-center justify-between gap-3 hover:bg-base-200/60 transition-colors cursor-pointer group"
            >
              {/* Left: Avatar + Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  <img
                    src={otherUser.profilePic || "/avatar.png"}
                    alt={otherUser.fullName || "User"}
                    className="size-12 object-cover rounded-full ring-1 ring-base-300"
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full ring-2 ring-base-100" />
                  )}
                </div>

                <div className="text-left min-w-0 flex-1">
                  <div
                    className={`font-medium truncate ${
                      !isOutgoing && isMissed ? "text-red-500" : "text-base-content"
                    }`}
                  >
                    {otherUser.fullName || "User"}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                    <StatusIcon className={`size-3.5 flex-shrink-0 ${iconColor}`} />
                    <span className="truncate">{statusLabel}</span>
                  </div>

                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {formatCallTime(call.createdAt)}
                  </div>
                </div>
              </div>

              {/* Right: Quick Call Button */}
              <button
                type="button"
                onClick={(e) => handleCallBack(e, otherUser)}
                className="btn btn-circle btn-sm btn-ghost text-emerald-500 hover:bg-emerald-500/15 transition-all flex-shrink-0"
                title={`Call ${otherUser.fullName || "User"}`}
              >
                <Phone className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CallHistoryTab;
