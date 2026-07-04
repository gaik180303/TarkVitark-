import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

let seq = 0;
const authedAgent = async () => {
  seq += 1;
  const email = `voter${seq}@test.com`;
  await request(app)
    .post('/api/v1/users/register')
    .field('fullName', 'Voter')
    .field('username', `voter${seq}`)
    .field('email', email)
    .field('password', 'password123');
  const agent = request.agent(app);
  await agent.post('/api/v1/users/login').send({ email, password: 'password123' });
  return agent;
};

// Creates an ongoing debate (so post-votes are allowed) and returns its id.
const makeOngoingDebate = async (agent) => {
  const res = await agent.post('/api/v1/debates/create').send({
    title: 'Motion',
    description: 'desc',
    scheduledAt: '2020-01-01T10:00:00.000Z', // in the past -> eligible to be ongoing
  });
  const id = res.body.data._id;
  // Force it "ongoing" directly so post-votes are permitted without the cron.
  const { DebateRoom } = await import('../src/models/debateRoom.model.js');
  await DebateRoom.findByIdAndUpdate(id, { status: 'ongoing' });
  return id;
};

describe('Minds-Changed voting', () => {
  it('records pre and post votes and computes the swing verdict', async () => {
    const host = await authedAgent();
    const debateId = await makeOngoingDebate(host);

    // Two voters lean "against" before, then flip to "in_favor" after.
    const a = await authedAgent();
    const b = await authedAgent();

    for (const voter of [a, b]) {
      await voter.post(`/api/v1/debates/${debateId}/votes`).send({ phase: 'pre', stance: 'against' });
    }
    for (const voter of [a, b]) {
      const res = await voter
        .post(`/api/v1/debates/${debateId}/votes`)
        .send({ phase: 'post', stance: 'in_favor' });
      expect(res.status).toBe(200);
    }

    const summary = await host.get(`/api/v1/debates/${debateId}/votes/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.summary.pre.against).toBe(2);
    expect(summary.body.data.summary.post.in_favor).toBe(2);
    // +2 for, -2 against => the motion won the room over
    expect(summary.body.data.verdict.winner).toBe('in_favor');
  });

  it('lets a user change their vote within a phase (no duplicate)', async () => {
    const host = await authedAgent();
    const debateId = await makeOngoingDebate(host);
    const voter = await authedAgent();

    await voter.post(`/api/v1/debates/${debateId}/votes`).send({ phase: 'pre', stance: 'against' });
    await voter.post(`/api/v1/debates/${debateId}/votes`).send({ phase: 'pre', stance: 'in_favor' });

    const summary = await voter.get(`/api/v1/debates/${debateId}/votes/summary`);
    expect(summary.body.data.summary.pre.in_favor).toBe(1);
    expect(summary.body.data.summary.pre.against).toBe(0);
    expect(summary.body.data.myVote.pre).toBe('in_favor');
  });

  it('rejects a post-vote before the debate starts', async () => {
    const host = await authedAgent();
    const created = await host.post('/api/v1/debates/create').send({
      title: 'Future', description: 'desc', scheduledAt: '2030-01-01T10:00:00.000Z',
    });
    const debateId = created.body.data._id; // still 'scheduled'

    const res = await host
      .post(`/api/v1/debates/${debateId}/votes`)
      .send({ phase: 'post', stance: 'in_favor' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid stance/phase with 400', async () => {
    const host = await authedAgent();
    const debateId = await makeOngoingDebate(host);
    const res = await host
      .post(`/api/v1/debates/${debateId}/votes`)
      .send({ phase: 'pre', stance: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/debates/507f1f77bcf86cd799439011/votes/summary');
    expect(res.status).toBe(401);
  });
});
