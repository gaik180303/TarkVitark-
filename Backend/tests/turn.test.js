import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import setupSocket from '../src/socket.js';
import { User } from '../src/models/user.model.js';
import { DebateRoom } from '../src/models/debateRoom.model.js';
import DebateRegistration from '../src/models/debateRegistration.model.js';

let server;
let url;

beforeAll(async () => {
  server = http.createServer();
  setupSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const tokenFor = (user) =>
  jwt.sign({ _id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });

const connectAndJoin = (user, roomId) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(url, { reconnection: false, auth: { token: tokenFor(user) } });
    socket.on('connect_error', reject);
    socket.on('connect', () => socket.emit('joinRoom', { roomId }));
    socket.once('roomUpdate', () => resolve(socket));
  });

let seq = 0;
const makeUser = (role) => {
  seq += 1;
  return User.create({
    fullName: role, username: `${role}${seq}`, email: `${role}${seq}@t.com`, password: 'password123',
  });
};

describe('Server-enforced turns', () => {
  it('only the host can start the debate, and turns enforce speaking order', async () => {
    const host = await makeUser('host');
    const forUser = await makeUser('for');
    const againstUser = await makeUser('against');

    const debate = await DebateRoom.create({
      title: 'Turns', description: 'd', host: host._id,
      participants: [host._id, forUser._id, againstUser._id],
      status: 'scheduled', scheduledAt: new Date(),
    });
    const roomId = debate._id.toString();

    await DebateRegistration.create({
      debate: debate._id, participant: { user: forUser._id, stance: 'in_favor', agreedToRules: true },
    });
    await DebateRegistration.create({
      debate: debate._id, participant: { user: againstUser._id, stance: 'against', agreedToRules: true },
    });

    const hostSock = await connectAndJoin(host, roomId);
    const forSock = await connectAndJoin(forUser, roomId);
    const againstSock = await connectAndJoin(againstUser, roomId);

    // Non-host cannot start
    const nonHostErr = await new Promise((resolve) => {
      forSock.once('error', resolve);
      forSock.emit('startDebate', { roomId, turnSeconds: 45 });
    });
    expect(nonHostErr.message).toMatch(/only the host/i);

    // Host starts -> first turn is the "For" side
    const firstTurn = await new Promise((resolve) => {
      hostSock.once('turnUpdate', resolve);
      hostSock.emit('startDebate', { roomId, turnSeconds: 45 });
    });
    expect(firstTurn.active).toBe(true);
    expect(firstTurn.currentStance).toBe('in_favor');

    // The "Against" side cannot speak during the "For" turn
    const outOfTurn = await new Promise((resolve) => {
      againstSock.once('error', resolve);
      againstSock.emit('sendMessage', { roomId, content: 'let me in' });
    });
    expect(outOfTurn.message).toMatch(/for side/i);

    // The "For" side can speak, and the message carries its stance
    const msg = await new Promise((resolve) => {
      forSock.once('receiveMessage', resolve);
      forSock.emit('sendMessage', { roomId, content: 'my opening point' });
    });
    expect(msg.content).toBe('my opening point');
    expect(msg.stance).toBe('in_favor');

    // Host ends the debate
    const ended = await new Promise((resolve) => {
      hostSock.once('turnUpdate', resolve);
      hostSock.emit('endDebate', { roomId });
    });
    expect(ended.active).toBe(false);

    [hostSock, forSock, againstSock].forEach((s) => s.disconnect());
  });
});
