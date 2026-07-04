// Strip MongoDB operator injection from the request body. Keys beginning with
// "$" or containing "." are how attackers smuggle query operators (e.g.
// { "email": { "$gt": "" } }). express-mongo-sanitize can't be used on Express 5
// because req.query is a read-only getter — and query params are always strings,
// so injection is only a real risk in the JSON body. We sanitize body in place.
const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }
  return value;
};

export const mongoSanitize = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
};
