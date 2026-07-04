import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { verifyJWT } from '../src/middlewares/auth.middleware.js';
import { User } from '../src/models/user.model.js';

// Minimal Express-like req/res/next harness. asyncHandler forwards thrown
// ApiErrors to next(err), so we assert on what next receives.
const runMiddleware = (req) =>
  new Promise((resolve) => {
    const res = {};
    verifyJWT(req, res, (err) => resolve(err));
  });

let seq = 0;
const makeUser = () => {
  seq += 1;
  return User.create({
    fullName: 'Mid User',
    username: `mw${seq}`,
    email: `mw${seq}@test.com`,
    password: 'password123',
  });
};

describe('verifyJWT middleware', () => {
  it('rejects when no token is present', async () => {
    const err = await runMiddleware({ cookies: {}, header: () => undefined });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });

  it('rejects a malformed/expired token', async () => {
    const err = await runMiddleware({
      cookies: { accessToken: 'garbage.token.value' },
      header: () => undefined,
    });
    expect(err.statusCode).toBe(401);
  });

  it('accepts a valid token and attaches req.user without secrets', async () => {
    const user = await makeUser();
    const token = jwt.sign({ _id: user._id }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1d',
    });
    const req = { cookies: { accessToken: token }, header: () => undefined };
    const err = await runMiddleware(req);

    expect(err).toBeUndefined();
    expect(req.user._id.toString()).toBe(user._id.toString());
    expect(req.user.password).toBeUndefined();
    expect(req.user.refreshToken).toBeUndefined();
  });

  it('reads the token from the Authorization header too', async () => {
    const user = await makeUser();
    const token = jwt.sign({ _id: user._id }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1d',
    });
    const req = { cookies: {}, header: (name) => (name === 'Authorization' ? `Bearer ${token}` : undefined) };
    const err = await runMiddleware(req);
    expect(err).toBeUndefined();
    expect(req.user.username).toBe(user.username);
  });
});
