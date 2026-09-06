import express from 'express';
import authRouter from './routes/auth.route.js'
import messageRoute from './routes/message.route.js'
import callRoute from './routes/call.route.js'
import dotenv from 'dotenv'
import { connectDB } from './lib/db.js';
import cookieParser from 'cookie-parser';
import cors from 'cors'
import bodyParser from 'body-parser';
import { app, server } from './lib/socket.js';
dotenv.config();

const PORT = process.env.PORT || 5001;

// Trust proxy is required for secure cookies when behind reverse proxies (e.g., Render, Railway, Heroku)
app.set("trust proxy", 1);

// app.use(express.bodyParser({limit: '50mb'}));
app.use(express.json({limit: '50mb'}));
app.use(cookieParser());
const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // In development, allow all origins
        if (process.env.NODE_ENV === "development" || !origin) {
            return callback(null, true);
        }
        if (
            allowedOrigins.includes(origin) ||
            origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:") ||
            origin.startsWith("http://192.168.") ||
            origin.startsWith("http://10.")
        ) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

app.use('/api/auth', authRouter);
app.use('/api/message', messageRoute);
app.use('/api/calls', callRoute);

app.get('/', (req, res) => {
    res.send('API is running...');
});

server.listen(PORT, "0.0.0.0", ()=>{
    console.log(`server is running on ${PORT}`);
    connectDB();
})