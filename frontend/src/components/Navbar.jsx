import React from 'react'
import {LogOut, MessageSquare, PersonStanding, Settings, User} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore.js'
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const {logout, authUser}  = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () =>{
    logout();
    navigate("/login");

  }
  return (
    <div className='flex  mx-2 py-2 justify-between sm:mx-10'>
      <Link to="/" className='flex justify-center items-center hover:opacity-80 transition-opacity'>
        <div className='flex justify-center size-8 items-center bg-primary/10 rounded-lg'>
           <MessageSquare className='size-5 text-primary' /> 
        </div>
        <h2 className='text-xl ml-1 font-bold'>CHATTY</h2>
      </Link>
      <div className='flex gap-4'>
        <Link to="/settings" className='btn flex justify-center items-center bg-base-200 px-3 py-2 rounded-lg gap-1' >
          <Settings className='size-6' />
          <p className='font-bold text-sm max-sm:hidden'>Settings</p>      
        </Link>
        {authUser?(<Link to="/profile" className='btn flex justify-center items-center bg-base-200 px-3 py-2 rounded-lg gap-1' >
          <User className='size-6' />
          <p className='font-bold text-sm max-sm:hidden'>Profile</p>      
        </Link>):null}

        {authUser?(
          <button className="btn" onClick={handleLogout}>
            <LogOut className='size-6' />
            <p className='font-bold max-sm:hidden'>Logout</p>
        </button>):null}
      </div>
    </div>
  )
}

export default Navbar