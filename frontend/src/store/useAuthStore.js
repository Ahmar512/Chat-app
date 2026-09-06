import {create} from 'zustand';
import {axiosInstance} from "../lib/axios.js"
import toast from 'react-hot-toast';
import {io} from 'socket.io-client';


const BASE_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.MODE === "development" ? "http://localhost:5001" : "/");

export const useAuthStore = create((set, get)=>({
    authUser : null,
    isSigningUp: false,
    isLoggingin: false,
    isUpdatingProfile:false,
    onlineUsers: [],
    isCheckingAuth: true,
    socket:null,

    checkAuth: async () =>{
        try {
            const res = await axiosInstance.get("/auth/check");

            set({authUser: res.data});
            get().connectSocket();
            
        } catch (error) {
            console.log("Error in checkAuth: ", error);
            set({authUser:null});
        }finally{
            set({isCheckingAuth:false});
        }
    },
    signup: async (data) =>{
        try {
            set({isSigningUp:true})
            const res = await axiosInstance.post("/auth/signup",({fullName:data.fullName, email:data.email, password:data.password}));
            set({authUser:res.data});
            toast.success("Account created successfully");
            get().connectSocket();
        } catch (error) {
            console.log(error);
            toast.error(error.response.data.message);
        }finally{
            set({isSigningUp:false});
        }
    },
    login: async(data) =>{
        try{
            set({isLoggingin:true});
            const res = await axiosInstance.post("/auth/login",({email:data.email, password:data.password}))
            set({authUser:res.data});
            toast.success("Logged in successfully");
            get().connectSocket();
        }catch(error){
            console.log(error);
            toast.error(error.response.data.message);
        }finally{
            set({isLoggingin:false});
        }
    },
    logout: async () =>{
        try{
            const res = await axiosInstance.post("/auth/logout");
            set({authUser:null});
            toast.success("Logged out successfully");
            get().disconnectSocket();
        }catch(error){
            console.log("error in logout: ", error);
            toast.error(error.response.data.message);
        }
    },
    updateProfile: async (data) =>{
        set({isUpdatingProfile:true});
        try {
            const res = await axiosInstance.put('/auth/update-profile', data);
            set({authUser:res.data});
            toast.success("Profile updated successfully");
        } catch (error) {
            console.log("Error is update profile: ", error);
            toast.error(error.response.data.message);
        }finally{
            set({isUpdatingProfile:false});
        }
    },
    connectSocket: () =>{
        const {authUser} = get();
        if(!authUser || get().socket?.connected) return;
        
        const socket = io(BASE_URL,{
            query:{
                userId: authUser._id,
            },
        });
        socket.connect();

        set({socket:socket});

        socket.on("getOnlineUsers", (userIds) =>{
            set({onlineUsers:userIds});
        })



    },
    disconnectSocket: ()=>{
        if(get().socket?.connected) get().socket.disconnect();
    },

}))