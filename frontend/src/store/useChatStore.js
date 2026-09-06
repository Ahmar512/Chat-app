import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore.js";

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    searchResults: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isSearching: false,

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/message/users");
            set({ users: res.data });
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || "Failed to load users";
            toast.error(msg);
        } finally {
            set({ isUsersLoading: false });
        }
    },

    searchUsers: async (search = "") => {
        set({ isSearching: true });
        try {
            const res = await axiosInstance.get(`/message/search?search=${encodeURIComponent(search)}`);
            set({ searchResults: res.data });
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || "Failed to search users";
            toast.error(msg);
        } finally {
            set({ isSearching: false });
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/message/${userId}`);
            set({ messages: res.data });
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || "Failed to load messages";
            toast.error(msg);
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages, users } = get();
        try {
            const res = await axiosInstance.post(`/message/send/${selectedUser._id}`, messageData);
            set({ messages: [...messages, res.data] });

            // Ensure selectedUser is at top of users list with lastMessage
            const remaining = users.filter((u) => u._id !== selectedUser._id);
            const updatedUser = {
                ...selectedUser,
                lastMessage: {
                    text: res.data.text,
                    image: res.data.image,
                    createdAt: res.data.createdAt,
                    isSender: true,
                },
            };
            set({ users: [updatedUser, ...remaining] });
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || "Failed to send message";
            toast.error(msg);
        }
    },

    subscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("newMessage"); // Avoid duplicate listeners
        socket.on("newMessage", (newMessage) => {
            const { selectedUser, messages, users } = get();

            // If message is from current selected user, add to messages
            if (selectedUser && newMessage.senderId === selectedUser._id) {
                set({ messages: [...messages, newMessage] });
            }

            // Update users list order with last message
            const senderId = newMessage.senderId;
            const existingUser = users.find((u) => u._id === senderId);
            if (existingUser) {
                const remaining = users.filter((u) => u._id !== senderId);
                const updated = {
                    ...existingUser,
                    lastMessage: {
                        text: newMessage.text,
                        image: newMessage.image,
                        createdAt: newMessage.createdAt,
                        isSender: false,
                    },
                };
                set({ users: [updated, ...remaining] });
            } else {
                // If it's a new sender, refresh users so they appear in Chats list
                get().getUsers();
            }
        });
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
            socket.off("newMessage");
        }
    },

    setSelectedUser: (selectedUser) => set({ selectedUser }),
}));