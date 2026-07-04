export const DB_NAME = "debate_db";

// Frontend (Vercel) and backend (Render) are cross-site in production, which requires
// sameSite "none" + secure. Locally we run over plain http, where "none" cookies are
// rejected by browsers — so fall back to "lax" (localhost ports are same-site).
const isProduction = process.env.NODE_ENV === "production";

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
};
