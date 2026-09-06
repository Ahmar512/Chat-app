import React from 'react'
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { X, ArrowLeft } from 'lucide-react';

import CallButton from './CallButton';

const ChatHeader = () => {
    const {selectedUser, setSelectedUser} = useChatStore();
    const {onlineUsers} = useAuthStore();

  return (
    <div className='p-2.5 border-b border-base-300'>
        <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 sm:gap-3'>
                {/* Back button for mobile */}
                <button 
                    onClick={() => setSelectedUser(null)}
                    className="btn btn-sm btn-circle btn-ghost text-base-content/80 hover:bg-base-200 md:hidden"
                    title="Back to contacts"
                >
                    <ArrowLeft className="size-5" />
                </button>

                {/* Avatar */}
                <div className='avatar'>
                    <div className='size-10 rounded-full relative'>
                        <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                    </div>
                </div>
                {/* User info */}
                <div>
                    <h3 className='font-medium text-sm sm:text-base leading-tight'>{selectedUser.fullName}</h3>
                    <p className='text-xs text-base-content/70'>{onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}</p>
                </div>
            </div>
            {/* Call and Close buttons */}
            <div className='flex items-center gap-1 sm:gap-1.5'>
                <CallButton type="audio" />
                <CallButton type="video" />
                <button 
                    onClick={() => setSelectedUser(null)}
                    className="btn btn-sm btn-circle btn-ghost hidden md:flex text-base-content/70 hover:bg-base-content/10"
                    title="Close chat"
                >
                    <X className="size-5" />
                </button>
            </div>
        </div>

    </div>
  )
}

export default ChatHeader