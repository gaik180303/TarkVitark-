import dotenv from "dotenv";
import { z } from "zod";

// Load .env here (not in server.js) so it runs before any imported module reads
// process.env — ES module imports are hoisted above top-level statements.
dotenv.config({ path: "./.env" });

// Validate required environment variables at startup so the process fails fast
// with a clear message instead of throwing on the first request that needs them.
const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRY: z.string().min(1).default("1d"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),
  REFRESH_TOKEN_EXPIRY: z.string().min(1).default("10d"),
  // Cloudinary is optional — avatar upload just fails gracefully without it
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export const validateEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    console.error("See Backend/.env.example for the full list of required variables.\n");
    process.exit(1);
  }

  return parsed.data;
};

export const env = validateEnv();
