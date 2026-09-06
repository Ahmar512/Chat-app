import React, { useState, useEffect, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { Search, X, MessageSquare, Phone, Video, UserPlus } from "lucide-react";

const AddUserTab = ({ onUserSelected }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { searchResults, isSearching, searchUsers, setSelectedUser } = useChatStore();
  const { initiateCall } = useCallStore();
  const { onlineUsers } = useAuthStore();

  // Initial fetch
  useEffect(() => {
    searchUsers("");
  }, [searchUsers]);

  // Debounced search on typing
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, searchUsers]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (onUserSelected) onUserSelected(user);
  };

  const handleCallBack = (e, user) => {
    e.stopPropagation();
    initiateCall(user);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-base-300">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input input-sm input-bordered w-full pl-9 pr-8 bg-base-200 focus:bg-base-100 rounded-lg text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-base-content"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide border-b border-base-200/50 flex justify-between items-center">
        <span>{searchTerm ? "Search Results" : "All People"}</span>
        <span className="text-[11px] font-normal normal-case text-zinc-500">
          {searchResults.length} {searchResults.length === 1 ? "person" : "people"}
        </span>
      </div>

      {/* User list */}
      <div className="overflow-y-auto w-full py-1 flex-1">
        {isSearching && searchResults.length === 0 ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-11 rounded-full bg-base-300 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-base-300 rounded w-1/2" />
                  <div className="h-3 bg-base-300 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-zinc-500">
            <div className="size-12 rounded-full bg-base-200 flex items-center justify-center mb-3">
              <Search className="size-6 text-zinc-400" />
            </div>
            <h4 className="font-semibold text-sm text-base-content mb-1">
              No users found
            </h4>
            <p className="text-xs text-zinc-400 max-w-[200px]">
              {searchTerm
                ? `No user matching "${searchTerm}". Try another name or email.`
                : "No other users on the platform yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-base-200/40">
            {searchResults.map((user) => {
              const isOnline = onlineUsers.includes(user._id);

              return (
                <div
                  key={user._id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full p-3 flex items-center justify-between gap-3 hover:bg-base-200/60 transition-colors cursor-pointer group"
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                        className="size-11 object-cover rounded-full ring-1 ring-base-300"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-500 rounded-full ring-2 ring-base-100" />
                      )}
                    </div>

                    <div className="text-left min-w-0 flex-1">
                      <div className="font-medium truncate text-sm text-base-content group-hover:text-primary transition-colors">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Message, Audio Call & Video Call */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectUser(user);
                      }}
                      className="btn btn-circle btn-sm btn-ghost text-primary hover:bg-primary/10"
                      title="Chat"
                    >
                      <MessageSquare className="size-3.5 sm:size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCallBack(e, user)}
                      className="btn btn-circle btn-sm btn-ghost text-emerald-500 hover:bg-emerald-500/10"
                      title="Voice Call"
                    >
                      <Phone className="size-3.5 sm:size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        initiateCall(user, "video");
                      }}
                      className="btn btn-circle btn-sm btn-ghost text-secondary hover:bg-secondary/10"
                      title="Video Call"
                    >
                      <Video className="size-3.5 sm:size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddUserTab;
