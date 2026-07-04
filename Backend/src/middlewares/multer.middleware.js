import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Temp staging area for uploads before they go to Cloudinary.
// Not inside a statically-served directory, and created on boot (multer won't create it).
const TEMP_DIR = "./tmp/uploads";
fs.mkdirSync(TEMP_DIR, { recursive: true });

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

export const upload = multer({ storage });

export const multerUploads = upload.fields([
    { name: "profilePic", maxCount: 1 }
]);
