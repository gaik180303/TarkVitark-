import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cleanup must never mask the upload result/error
const removeLocalFile = (localFilePath) => {
    try {
        fs.unlinkSync(localFilePath);
    } catch {
        // Temp file already gone or locked — nothing actionable
    }
};

const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) return null;
    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'image',
        });
        return response;
    } catch (error) {
        console.error("Cloudinary upload failed:", error.message);
        return null;
    } finally {
        removeLocalFile(localFilePath);
    }
};

export { uploadOnCloudinary };
