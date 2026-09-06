import axios from 'axios';

const backendUrl = 
    import.meta.env.VITE_BACKEND_URL || 
    import.meta.env.BACKEND_URL || 
    (import.meta.env.MODE === "development" ? "http://localhost:5009" : "");

export const axiosInstance = axios.create({
    baseURL: `${backendUrl}/api`,
    withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});