import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const validUser = {
  fullName: 'Alice Kumar',
  username: 'alice',
  email: 'alice@test.com',
  password: 'password123',
};

const registerViaApi = (overrides = {}) => {
  const u = { ...validUser, ...overrides };
  return request(app)
    .post('/api/v1/users/register')
    .field('fullName', u.fullName)
    .field('username', u.username)
    .field('email', u.email)
    .field('password', u.password);
};

describe('Auth lifecycle', () => {
  it('registers a new user and never returns the password hash', async () => {
    const res = await registerViaApi();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('alice');
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('rejects a duplicate email/username with 409', async () => {
    await registerViaApi();
    const res = await registerViaApi();
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects a short password with a 400 validation error', async () => {
    const res = await registerViaApi({ password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
  });

  it('logs in with valid credentials and sets httpOnly cookies', async () => {
    await registerViaApi();
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('alice');
    // tokens must NOT be in the response body
    expect(res.body.data.accessToken).toBeUndefined();
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/accessToken=/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it('returns a generic 401 for both wrong password and unknown user', async () => {
    await registerViaApi();
    const wrongPass = await request(app)
      .post('/api/v1/users/login')
      .send({ email: validUser.email, password: 'totally-wrong' });
    const unknown = await request(app)
      .post('/api/v1/users/login')
      .send({ email: 'ghost@test.com', password: 'whatever12' });

    expect(wrongPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    // identical message => no account enumeration
    expect(wrongPass.body.message).toBe(unknown.body.message);
    expect(wrongPass.body.message).toBe('Invalid credentials');
  });

  it('strips mongo operator injection from the login body', async () => {
    await registerViaApi();
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: { $gt: '' }, password: 'password123' });
    // sanitizer strips $gt -> empty object -> validation rejects non-string
    expect(res.status).toBe(400);
  });

  it('supports the full register -> login -> me -> refresh -> logout flow', async () => {
    await registerViaApi();
    const agent = request.agent(app);

    const login = await agent
      .post('/api/v1/users/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/v1/users/current');
    expect(me.status).toBe(200);
    expect(me.body.data.username).toBe('alice');

    const refresh = await agent.post('/api/v1/users/refresh');
    expect(refresh.status).toBe(200);

    const logout = await agent.post('/api/v1/users/logout');
    expect(logout.status).toBe(200);

    const afterLogout = await agent.get('/api/v1/users/current');
    expect(afterLogout.status).toBe(401);
  });

  it('blocks protected routes without a token', async () => {
    const res = await request(app).get('/api/v1/users/current');
    expect(res.status).toBe(401);
  });
});
