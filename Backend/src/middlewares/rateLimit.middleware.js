import rateLimit from "express-rate-limit";

// Strict limiter for auth endpoints — blunts credential brute-forcing.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip limiting during tests so the suite can hammer the endpoints
  skip: () => process.env.NODE_ENV === "test",
  message: { success: false, message: "Too many attempts. Please try again later." },
});

// Generous global limiter as a general abuse backstop.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { success: false, message: "Too many requests. Please slow down." },
});
