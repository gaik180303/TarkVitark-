import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parseCookie as parseCookies } from 'cookie';
import { DebateRoom } from './models/debateRoom.model.js';
import DebateRegistration from './models/debateRegistration.model.js';
import Message from './models/message.model.js';
import { User } from './models/user.model.js';
import { scheduleFactCheck, scheduleDebateSummary } from './services/debateAnalysis.service.js';

const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());

const MAX_MESSAGE_LENGTH = 2000;
const TURN_ORDER = ['in_favor', 'against'];
const DEFAULT_TURN_SECONDS = 45;

// Exposed so REST controllers (e.g. voting) can push real-time updates into rooms.
let ioInstance = null;
export const getIO = () => ioInstance;

// Identity comes from a verified JWT (cookie or handshake auth), never from the client.
const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie || '');
    const token = cookies.accessToken || socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Unauthorized: no token provided'));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id).select('username fullName avatarUrl');
    if (!user) {
      return next(new Error('Unauthorized: user not found'));
    }

    socket.user = { id: user._id.toString(), username: user.username };
    next();
  } catch {
    next(new Error('Unauthorized: invalid or expired token'));
  }
};

export default function setupSocket(server) {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  ioInstance = io;

  io.use(authenticateSocket);

  // Presence (who's online) and turn state (whose side may speak), per room.
  const rooms = {};
  const turnStates = new Map();

  const clearTurns = (key) => {
    const state = turnStates.get(key);
    if (state?.timer) clearTimeout(state.timer);
    turnStates.delete(key);
  };

  // Server-authoritative alternating turns; the client only reflects what we broadcast.
  const startTurnCycle = (roomId, turnSeconds) => {
    const key = String(roomId);
    clearTurns(key);
    const state = { active: true, turnNumber: 0, turnSeconds, currentStance: TURN_ORDER[0] };
    turnStates.set(key, state);

    const tick = () => {
      state.currentStance = TURN_ORDER[state.turnNumber % TURN_ORDER.length];
      state.turnEndsAt = Date.now() + turnSeconds * 1000;
      io.to(key).emit('turnUpdate', {
        active: true,
        currentStance: state.currentStance,
        turnEndsAt: state.turnEndsAt,
        turnNumber: state.turnNumber,
      });
      state.turnNumber += 1;
      state.timer = setTimeout(tick, turnSeconds * 1000);
    };
    tick();
  };

  io.on('connection', (socket) => {
    const joinedRooms = new Set();
    const stanceByRoom = new Map();

    socket.on('joinRoom', async ({ roomId }) => {
      try {
        const room = await DebateRoom.findById(roomId).lean();
        if (!room) return socket.emit('error', { message: 'Room not found.' });

        const isParticipant = room.participants.some((p) => p.toString() === socket.user.id);
        if (!isParticipant) {
          return socket.emit('error', { message: 'You are not a registered participant.' });
        }

        const registration = await DebateRegistration.findOne({
          debate: roomId,
          'participant.user': socket.user.id,
        }).lean();
        const stance = registration?.participant?.stance ?? null;
        const isHost = room.host.toString() === socket.user.id;
        stanceByRoom.set(String(roomId), stance);

        socket.join(roomId);
        joinedRooms.add(String(roomId));

        if (!rooms[roomId]) rooms[roomId] = { participants: [] };
        const presence = { id: socket.user.id, username: socket.user.username, stance, isHost };
        if (!rooms[roomId].participants.some((p) => p.id === socket.user.id)) {
          rooms[roomId].participants.push(presence);
        }

        io.to(roomId).emit('roomUpdate', { participants: rooms[roomId].participants });

        // Tell the newcomer the current turn state (if a debate is already running).
        const state = turnStates.get(String(roomId));
        if (state?.active) {
          socket.emit('turnUpdate', {
            active: true,
            currentStance: state.currentStance,
            turnEndsAt: state.turnEndsAt,
            turnNumber: state.turnNumber - 1,
          });
        }
      } catch {
        socket.emit('error', { message: 'Server error joining room.' });
      }
    });

    // Host-only: begin timed, alternating turns.
    socket.on('startDebate', async ({ roomId, turnSeconds }) => {
      try {
        const room = await DebateRoom.findById(roomId).lean();
        if (!room) return socket.emit('error', { message: 'Room not found.' });
        if (room.host.toString() !== socket.user.id) {
          return socket.emit('error', { message: 'Only the host can start the debate.' });
        }
        const secs = Math.min(Math.max(Number(turnSeconds) || DEFAULT_TURN_SECONDS, 10), 300);
        await DebateRoom.findByIdAndUpdate(roomId, { status: 'ongoing' });
        startTurnCycle(roomId, secs);
      } catch {
        socket.emit('error', { message: 'Could not start the debate.' });
      }
    });

    // Host-only: end the debate (enables post-votes, stops the clock).
    socket.on('endDebate', async ({ roomId }) => {
      try {
        const room = await DebateRoom.findById(roomId).lean();
        if (!room) return socket.emit('error', { message: 'Room not found.' });
        if (room.host.toString() !== socket.user.id) {
          return socket.emit('error', { message: 'Only the host can end the debate.' });
        }
        clearTurns(String(roomId));
        await DebateRoom.findByIdAndUpdate(roomId, { status: 'ended' });
        io.to(String(roomId)).emit('turnUpdate', { active: false });
        io.to(String(roomId)).emit('debateEnded');

        // Generate the AI match report (summary + judge + stats); emitted when ready.
        scheduleDebateSummary(io, roomId);
      } catch {
        socket.emit('error', { message: 'Could not end the debate.' });
      }
    });

    socket.on('sendMessage', async ({ roomId, content, evidenceUrl }) => {
      try {
        const key = String(roomId);
        if (!joinedRooms.has(key)) {
          return socket.emit('error', { message: 'Join the room before sending messages.' });
        }
        if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) {
          return socket.emit('error', { message: 'Message must be 1-2000 characters.' });
        }
        if (evidenceUrl && !isHttpUrl(evidenceUrl)) {
          return socket.emit('error', { message: 'Evidence must be a valid http(s) link.' });
        }

        // If turns are running, only the current side may speak. The host (null stance)
        // may always speak, to moderate.
        const state = turnStates.get(key);
        const myStance = stanceByRoom.get(key);
        if (state?.active && myStance && myStance !== state.currentStance) {
          const side = state.currentStance === 'in_favor' ? 'For' : 'Against';
          return socket.emit('error', { message: `It's the ${side} side's turn to speak.` });
        }

        const newMessage = await Message.create({
          debateId: roomId,
          content: content.trim(),
          sender: socket.user.id,
          stance: myStance ?? null,
          evidenceUrl: evidenceUrl ? evidenceUrl.trim() : null,
        });
        await newMessage.populate('sender', 'fullName username avatarUrl');

        io.to(roomId).emit('receiveMessage', newMessage);

        // Fire-and-forget AI fact-check; badge arrives over the socket when ready.
        scheduleFactCheck(io, newMessage);
      } catch {
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // Toggle a "strong argument" star on a message.
    socket.on('starMessage', async ({ roomId, messageId }) => {
      try {
        if (!joinedRooms.has(String(roomId))) return;
        const message = await Message.findById(messageId);
        if (!message || String(message.debateId) !== String(roomId)) return;

        const uid = socket.user.id;
        const already = message.stars.some((s) => s.toString() === uid);
        if (already) message.stars = message.stars.filter((s) => s.toString() !== uid);
        else message.stars.push(uid);
        await message.save();

        io.to(String(roomId)).emit('messageStarred', {
          messageId: String(messageId),
          starCount: message.stars.length,
        });
      } catch {
        /* non-critical */
      }
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (rooms[roomId]) {
          rooms[roomId].participants = rooms[roomId].participants.filter(
            (p) => p.id !== socket.user.id
          );
          if (rooms[roomId].participants.length === 0) {
            delete rooms[roomId];
            clearTurns(String(roomId)); // no one left to debate — stop the clock
          } else {
            io.to(roomId).emit('roomUpdate', { participants: rooms[roomId].participants });
          }
        }
      }
    });
  });

  return io;
}
