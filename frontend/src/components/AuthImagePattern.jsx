import React from 'react'

const AuthImagePattern = ({title, subtitle}) => {
  return (
    <div className='max-lg:hidden flex justify-center items-center flex-col bg-base-200'>
        <div className='grid grid-cols-3 gap-2 h-fit w-fit'>
            <div className="skeleton h-32 w-32 "></div>
            <div className="skeleton h-32 w-32 bg-primary/20"></div>
            <div className="skeleton h-32 w-32"></div>
            <div className="skeleton h-32 w-32 bg-primary/20"></div>
            <div className="skeleton h-32 w-32"></div>
            <div className="skeleton h-32 w-32 bg-primary/20"></div>
            <div className="skeleton h-32 w-32"></div>
            <div className="skeleton h-32 w-32 bg-primary/20"></div>
            <div className="skeleton h-32 w-32"></div>
        </div>
        <h2 className='text-2xl font-bold mb-4 mt-2'>{title}</h2>
        <p className=' text-center text-base-content/60'>{subtitle}</p>
    </div>
  )
}

export default AuthImagePattern