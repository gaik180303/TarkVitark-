import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import apiRouter from './routes/index.js';

const app = express();

// CORS: comma-separated origins from env, e.g. "https://tark-vitark.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

app.use('/api/v1', apiRouter);

app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
});

// 404 for anything that didn't match a route
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler — converts ApiError (and common Mongoose errors) into JSON responses
app.use((err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal server error";

    if (err.name === "CastError") {
        statusCode = 400;
        message = "Invalid id format";
    } else if (err.code === 11000) {
        statusCode = 409;
        message = "A record with this value already exists";
    }

    if (statusCode >= 500) {
        console.error(err);
        message = "Internal server error";
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors: err.errors || []
    });
});

export { app };
