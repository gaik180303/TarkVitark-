import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';

import apiRouter from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { mongoSanitize } from './middlewares/sanitize.middleware.js';

const app = express();

// Security headers
app.use(helmet());

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
app.use(mongoSanitize);

// General abuse backstop across the whole API
app.use('/api/v1', apiLimiter, apiRouter);

app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
});

// 404 for anything that didn't match a route
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler — converts ApiError, Multer, and common Mongoose errors into JSON
app.use((err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal server error";
    let errors = err.errors || [];

    if (err instanceof multer.MulterError) {
        statusCode = 400;
        message = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 2 MB)" : `Upload error: ${err.message}`;
    } else if (err.name === "CastError") {
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

    res.status(statusCode).json({ success: false, message, errors });
});

export { app };
