import {create} from 'zustand';
import {axiosInstance} from "../lib/axios.js"
import toast from 'react-hot-toast';
import {io} from 'socket.io-client';
import { useCallStore } from './useCallStore.js';


const BASE_URL = 
    import.meta.env.VITE_BACKEND_URL || 
    import.meta.env.BACKEND_URL || 
    (import.meta.env.MODE === "development" ? "http://localhost:5009" : "/");

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
            localStorage.removeItem("token");
            set({authUser:null});
        }finally{
            set({isCheckingAuth:false});
        }
    },
    signup: async (data) =>{
        try {
            set({isSigningUp:true})
            const res = await axiosInstance.post("/auth/signup",({fullName:data.fullName, email:data.email, password:data.password}));
            if (res.data.token) localStorage.setItem("token", res.data.token);
            set({authUser:res.data});
            toast.success("Account created successfully");
            get().connectSocket();
        } catch (error) {
            console.log(error);
            const msg = error?.response?.data?.message || error?.message || "Signup failed";
            toast.error(msg);
        }finally{
            set({isSigningUp:false});
        }
    },
    login: async(data) =>{
        try{
            set({isLoggingin:true});
            const res = await axiosInstance.post("/auth/login",({email:data.email, password:data.password}))
            if (res.data.token) localStorage.setItem("token", res.data.token);
            set({authUser:res.data});
            toast.success("Logged in successfully");
            get().connectSocket();
        }catch(error){
            console.log(error);
            const msg = error?.response?.data?.message || error?.message || "Login failed";
            toast.error(msg);
        }finally{
            set({isLoggingin:false});
        }
    },
    logout: async () =>{
        try{
            const res = await axiosInstance.post("/auth/logout");
            localStorage.removeItem("token");
            set({authUser:null});
            toast.success("Logged out successfully");
            get().disconnectSocket();
        }catch(error){
            console.log("error in logout: ", error);
            localStorage.removeItem("token");
            const msg = error?.response?.data?.message || error?.message || "Logout failed";
            toast.error(msg);
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
            const msg = error?.response?.data?.message || error?.message || "Update profile failed";
            toast.error(msg);
        }finally{
            set({isUpdatingProfile:false});
        }
    },
    connectSocket: () => {
        const { authUser, socket } = get();
        if (!authUser) return;

        // If socket already exists and is connected, request online users
        if (socket?.connected) {
            socket.emit("requestOnlineUsers");
            return;
        }

        // If socket exists but disconnected, reconnect it
        if (socket && !socket.connected) {
            socket.connect();
            return;
        }

        const newSocket = io(BASE_URL, {
            query: {
                userId: authUser._id,
            },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        set({ socket: newSocket });

        newSocket.on("connect", () => {
            console.log("Socket connected:", newSocket.id);
            newSocket.emit("requestOnlineUsers");
        });

        newSocket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });

        newSocket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
            if (reason === "ioServerDisconnect") {
                // Server initiated disconnect, reconnect manually
                newSocket.connect();
            }
        });

        newSocket.on("connect_error", (error) => {
            console.log("Socket connection error:", error.message);
        });

        // Initialize calling listeners & ICE servers
        useCallStore.getState().setupCallListeners();
        useCallStore.getState().fetchIceServers();
    },

    disconnectSocket: () => {
        useCallStore.getState().endCall();
        useCallStore.getState().cleanupCallListeners();

        const socket = get().socket;
        if (socket) {
            socket.disconnect();
            set({ socket: null, onlineUsers: [] });
        }
    },
}));

// Auto-reconnect when mobile screen turns on or user refocuses the app tab
if (typeof window !== "undefined") {
    const handleRecheck = () => {
        const state = useAuthStore.getState();
        if (state.authUser) {
            if (state.socket && !state.socket.connected) {
                console.log("App refocused/visible: Reconnecting socket...");
                state.socket.connect();
            } else if (state.socket?.connected) {
                state.socket.emit("requestOnlineUsers");
            } else if (!state.socket) {
                state.connectSocket();
            }
        }
    };

    window.addEventListener("focus", handleRecheck);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            handleRecheck();
        }
    });
}