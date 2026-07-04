import { ApiError } from "../utils/ApiError.js";

// Runs a Zod schema against the chosen request part and replaces it with the
// parsed (type-safe, stripped) result. On failure it throws a 400 ApiError with
// per-field messages, which the global error handler renders as JSON.
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || source,
      message: issue.message,
    }));
    throw new ApiError(400, "Validation failed", errors);
  }

  // req.query/req.params are getter-only in Express 5 — only reassign body.
  if (source === "body") {
    req.body = result.data;
  } else {
    req.validated = { ...(req.validated || {}), [source]: result.data };
  }

  next();
};
