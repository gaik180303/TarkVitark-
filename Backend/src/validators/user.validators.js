import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const email = z.string().trim().toLowerCase().email("A valid email is required");
const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores");

// Multipart register: fields arrive as strings; the file is handled by multer separately.
export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  username,
  email,
  password,
});

export const loginSchema = z
  .object({
    email: email.optional(),
    username: z.string().trim().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.username, {
    message: "Username or email is required",
    path: ["email"],
  });

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: password,
});

export const updateAccountSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email,
});
