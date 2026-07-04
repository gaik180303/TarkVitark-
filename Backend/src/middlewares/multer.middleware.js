import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";

// Temp staging area for uploads before they go to Cloudinary.
// Not inside a statically-served directory, and created on boot (multer won't create it).
const TEMP_DIR = "./tmp/uploads";
fs.mkdirSync(TEMP_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TEMP_DIR);
    },
    filename: function (req, file, cb) {
        // Never trust the client-supplied filename
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError(400, "Only JPEG, PNG and WebP images are allowed"));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

export const multerUploads = upload.fields([
    { name: "profilePic", maxCount: 1 }
]);
