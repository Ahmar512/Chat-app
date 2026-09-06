import React, { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, MessageSquare, Phone, UserPlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import CallHistoryTab from "./CallHistoryTab";
import AddUserTab from "./AddUserTab";

const formatLastMessageTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } =
    useChatStore();
  const { callHistory, getCallHistory } = useCallStore();
  const { onlineUsers } = useAuthStore();
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "calls" | "add"
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  useEffect(() => {
    getUsers();
    getCallHistory();
  }, [getUsers, getCallHistory]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  return (
    <aside className="h-full w-full border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100">
      {/* Top Tab Switcher: Chats | Calls | Add */}
      <div className="p-2.5 sm:p-3 border-b border-base-300 bg-base-100">
        <div className="grid grid-cols-3 gap-1 bg-base-200 p-1 rounded-xl">
          {/* 1. Chats Tab */}
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "chats"
                ? "bg-base-100 text-primary shadow-sm"
                : "text-zinc-500 hover:text-base-content"
            }`}
          >
            <MessageSquare className="size-4 flex-shrink-0" />
            <span className="truncate">Chats</span>
            {users.length > 0 && (
              <span
                className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full flex-shrink-0 ${
                  activeTab === "chats"
                    ? "bg-primary/10 text-primary font-bold"
                    : "bg-base-300 text-zinc-500"
                }`}
              >
                {users.length}
              </span>
            )}
          </button>

          {/* 2. Calls Tab */}
          <button
            onClick={() => setActiveTab("calls")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "calls"
                ? "bg-base-100 text-primary shadow-sm"
                : "text-zinc-500 hover:text-base-content"
            }`}
          >
            <Phone className="size-4 flex-shrink-0" />
            <span className="truncate">Calls</span>
            {callHistory?.length > 0 && (
              <span
                className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full flex-shrink-0 ${
                  activeTab === "calls"
                    ? "bg-primary/10 text-primary font-bold"
                    : "bg-base-300 text-zinc-500"
                }`}
              >
                {callHistory.length}
              </span>
            )}
          </button>

          {/* 3. Add Tab (Beside Calls) */}
          <button
            onClick={() => setActiveTab("add")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "add"
                ? "bg-base-100 text-primary shadow-sm"
                : "text-zinc-500 hover:text-base-content"
            }`}
          >
            <UserPlus className="size-4 flex-shrink-0" />
            <span className="truncate">Add</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "chats" ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Online filter header */}
          <div className="border-b border-base-300 w-full px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlineOnly}
                  onChange={(e) => setShowOnlineOnly(e.target.checked)}
                  className="checkbox checkbox-xs sm:checkbox-sm checkbox-primary"
                />
                <span className="text-xs sm:text-sm font-medium">Show online only</span>
              </label>
              <span className="text-xs text-zinc-500 font-medium">
                ({Math.max(0, onlineUsers.length - 1)} online)
              </span>
            </div>
          </div>

          {/* User list */}
          {isUsersLoading ? (
            <SidebarSkeleton />
          ) : (
            <div className="overflow-y-auto w-full py-1 flex-1">
              {filteredUsers.map((user) => {
                const isOnline = onlineUsers.includes(user._id);
                const hasLastMsg = !!user.lastMessage;
                const lastMsgPreview = hasLastMsg
                  ? `${user.lastMessage.isSender ? "You: " : ""}${
                      user.lastMessage.text || (user.lastMessage.image ? "📷 Photo" : "")
                    }`
                  : isOnline
                  ? "Online"
                  : "Offline";

                return (
                  <button
                    key={user._id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-base-200/70 transition-colors border-b border-base-200/40 text-left ${
                      selectedUser?._id === user._id
                        ? "bg-base-200 ring-1 ring-base-300"
                        : ""
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                        className="size-12 object-cover rounded-full ring-1 ring-base-300"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full ring-2 ring-base-100" />
                      )}
                    </div>

                    {/* User & Last message info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="font-medium truncate text-sm text-base-content">
                          {user.fullName}
                        </div>
                        {hasLastMsg && (
                          <div className="text-[11px] text-zinc-400 flex-shrink-0">
                            {formatLastMessageTime(user.lastMessage.createdAt)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {lastMsgPreview}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-zinc-500">
                  <div className="size-12 rounded-full bg-base-200 flex items-center justify-center mb-3">
                    <MessageSquare className="size-6 text-zinc-400" />
                  </div>
                  <h4 className="font-semibold text-sm text-base-content mb-1">
                    {showOnlineOnly ? "No online chats" : "No conversations yet"}
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-[200px] mb-4">
                    {showOnlineOnly
                      ? "None of your chatted contacts are currently online."
                      : "Find people by searching their name or email in the Add tab."}
                  </p>
                  {!showOnlineOnly && (
                    <button
                      onClick={() => setActiveTab("add")}
                      className="btn btn-sm btn-primary gap-1.5"
                    >
                      <UserPlus className="size-4" />
                      <span>Find People</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === "calls" ? (
        <div className="flex flex-col flex-1 min-h-0">
          <CallHistoryTab />
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <AddUserTab onUserSelected={() => setActiveTab("chats")} />
        </div>
      )}
    </aside>
  );
};

export default Sidebar;