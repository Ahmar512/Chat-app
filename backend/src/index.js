import express from 'express';
import authRouter from './routes/auth.route.js'
import messageRoute from './routes/message.route.js'
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
app.use(cors({
    origin: process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));

app.use('/api/auth', authRouter);
app.use('/api/message', messageRoute);

app.get('/', (req, res) => {
    res.send('API is running...');
});

server.listen(PORT, ()=>{
    console.log(`server is running on ${PORT}`);
    connectDB();
})