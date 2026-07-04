import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import Message from '../src/models/message.model.js';

// Monotonic counter guarantees unique usernames/emails without time-based collisions.
let seq = 0;

// Registers + logs in a user, returning a cookie-persisting agent and the user id.
const authedAgent = async (overrides = {}) => {
  seq += 1;
  const u = {
    fullName: 'Test User',
    username: `user${seq}`,
    email: `user${seq}@test.com`,
    password: 'password123',
    ...overrides,
  };
  await request(app)
    .post('/api/v1/users/register')
    .field('fullName', u.fullName)
    .field('username', u.username)
    .field('email', u.email)
    .field('password', u.password);

  const agent = request.agent(app);
  const login = await agent
    .post('/api/v1/users/login')
    .send({ email: u.email, password: u.password });
  return { agent, userId: login.body.data.user._id };
};

describe('Debate + message history', () => {
  it('creates a debate with host taken from the session, not the body', async () => {
    const { agent, userId } = await authedAgent();
    const res = await agent.post('/api/v1/debates/create').send({
      title: 'AI helps humanity',
      description: 'A motion about AI',
      scheduledAt: '2030-01-01T10:00:00.000Z',
      host: 'ffffffffffffffffffffffff', // attacker-supplied host must be ignored
    });
    expect(res.status).toBe(201);
    expect(res.body.data.host).toBe(userId);
    expect(res.body.data.status).toBe('scheduled');
  });

  it('registers a participant and prevents double registration', async () => {
    const host = await authedAgent();
    const debate = await host.agent.post('/api/v1/debates/create').send({
      title: 'Motion X',
      description: 'desc',
      scheduledAt: '2030-01-01T10:00:00.000Z',
    });
    const debateId = debate.body.data._id;

    const bob = await authedAgent();
    const first = await bob.agent
      .post('/api/v1/debates/register')
      .send({ debateId, stance: 'against', agreedToRules: true });
    expect(first.status).toBe(201);

    const second = await bob.agent
      .post('/api/v1/debates/register')
      .send({ debateId, stance: 'against', agreedToRules: true });
    expect(second.status).toBe(409);
  });

  it('returns persisted history for a participant (regression: debateId field)', async () => {
    const { agent, userId } = await authedAgent();
    const debate = await agent.post('/api/v1/debates/create').send({
      title: 'History test',
      description: 'desc',
      scheduledAt: '2030-01-01T10:00:00.000Z',
    });
    const debateId = debate.body.data._id;

    await Message.create({ debateId, sender: userId, content: 'first point' });
    await Message.create({ debateId, sender: userId, content: 'second point' });

    const res = await agent.get(`/api/v1/messages/${debateId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].content).toBe('first point');
    expect(res.body.data[0].sender.username).toBeDefined();
  });

  it('forbids history access for a non-participant (403)', async () => {
    const host = await authedAgent();
    const debate = await host.agent.post('/api/v1/debates/create').send({
      title: 'Private',
      description: 'desc',
      scheduledAt: '2030-01-01T10:00:00.000Z',
    });
    const debateId = debate.body.data._id;

    const outsider = await authedAgent();
    const res = await outsider.agent.get(`/api/v1/messages/${debateId}`);
    expect(res.status).toBe(403);
  });

  it('rejects an invalid debate id with 400', async () => {
    const { agent } = await authedAgent();
    const res = await agent.get('/api/v1/messages/not-an-object-id');
    expect(res.status).toBe(400);
  });
});
