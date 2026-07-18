import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth.route.js'
import messageRoute from './routes/message.route.js'
import { connectDB } from './lib/db.js';
import cookieParser from 'cookie-parser';
import cors from 'cors'
import bodyParser from 'body-parser';
import { app, server } from './lib/socket.js';

const PORT = process.env.PORT;

// app.use(express.bodyParser({limit: '50mb'}));
app.use(express.json({limit: '50mb'}));
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials:true,
}))

app.use('/api/auth', authRouter);
app.use('/api/message',messageRoute);


server.listen(PORT, ()=>{
    console.log(`server is running on ${PORT}`);
    connectDB();
})