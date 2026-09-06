import React from 'react'
import { useChatStore } from '../store/useChatStore'
import Sidebar from '../components/Sidebar';
import NoChatSelected from '../components/NoChatSelected';
import ChatContainer from '../components/ChatContainer';


const HomePage = () => {
  const { selectedUser } = useChatStore();
  return (
    <div className='h-[calc(100dvh-4rem)] bg-base-200'>
      <div className='flex items-center justify-center sm:pt-4 sm:px-4 h-full'>
        <div className='bg-base-100 sm:rounded-lg shadow-xl w-full max-w-6xl h-full sm:h-[calc(100vh-6rem)] overflow-hidden'>
          <div className='flex h-full w-full'>
            {/* Sidebar: full width on mobile when no user selected; hidden on mobile when user selected */}
            <div className={`h-full ${selectedUser ? "hidden md:flex" : "flex"} w-full md:w-72 lg:w-80 flex-shrink-0`}>
              <Sidebar />
            </div>

            {/* Chat area: hidden on mobile when no user selected; full width on mobile when user selected */}
            <div className={`h-full flex-1 ${!selectedUser ? "hidden md:flex" : "flex"}`}>
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage