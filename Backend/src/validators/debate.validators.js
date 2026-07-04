import { z } from "zod";
import mongoose from "mongoose";

const objectId = z
  .string()
  .refine((val) => mongoose.isValidObjectId(val), "A valid id is required");

export const createDebateSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().min(3, "Description is required").max(2000),
  scheduledAt: z.coerce.date({ message: "scheduledAt must be a valid date" }),
});

export const registerForDebateSchema = z.object({
  debateId: objectId,
  stance: z.enum(["in_favor", "against"], { message: "Valid stance is required" }),
  agreedToRules: z.literal(true, { message: "You must agree to the debate rules" }),
});
