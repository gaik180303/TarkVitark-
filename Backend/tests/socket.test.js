import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import setupSocket from '../src/socket.js';
import { User } from '../src/models/user.model.js';
import { DebateRoom } from '../src/models/debateRoom.model.js';

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

const connect = (opts) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(url, { reconnection: false, ...opts });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });

describe('Socket authentication', () => {
  it('rejects a connection with no token', async () => {
    await expect(connect({})).rejects.toThrow(/unauthorized/i);
  });

  it('rejects identity supplied via query params (no valid token)', async () => {
    await expect(connect({ query: { userId: 'someone-else' } })).rejects.toThrow(/unauthorized/i);
  });

  it('accepts a valid token and does a message round-trip with JWT-derived sender', async () => {
    const alice = await User.create({
      fullName: 'Alice', username: 'sockalice', email: 'sockalice@test.com', password: 'password123',
    });
    const debate = await DebateRoom.create({
      title: 'Socket debate', description: 'desc', host: alice._id, participants: [alice._id],
      status: 'ongoing', scheduledAt: new Date(),
    });

    const socket = await connect({ auth: { token: tokenFor(alice) } });

    const received = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no message received')), 8000);
      socket.on('receiveMessage', (msg) => { clearTimeout(timer); resolve(msg); });
      socket.on('roomUpdate', () => {
        socket.emit('sendMessage', { roomId: debate._id.toString(), content: 'hello room' });
      });
      socket.emit('joinRoom', { roomId: debate._id.toString() });
    });

    expect(received.content).toBe('hello room');
    expect(received.sender.username).toBe('sockalice'); // identity from JWT, not client
    socket.disconnect();
  });

  it('rejects sending before joining a room', async () => {
    const bob = await User.create({
      fullName: 'Bob', username: 'sockbob', email: 'sockbob@test.com', password: 'password123',
    });
    const debate = await DebateRoom.create({
      title: 'Another', description: 'desc', host: bob._id, participants: [bob._id],
      status: 'ongoing', scheduledAt: new Date(),
    });

    const socket = await connect({ auth: { token: tokenFor(bob) } });
    const err = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no error emitted')), 8000);
      socket.on('error', (e) => { clearTimeout(timer); resolve(e); });
      socket.emit('sendMessage', { roomId: debate._id.toString(), content: 'sneaky' });
    });
    expect(err.message).toMatch(/join/i);
    socket.disconnect();
  });
});
