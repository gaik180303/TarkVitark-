import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parseCookie as parseCookies } from 'cookie';
import { DebateRoom } from './models/debateRoom.model.js';
import Message from './models/message.model.js';
import { User } from './models/user.model.js';

const MAX_MESSAGE_LENGTH = 2000;

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
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  // Presence tracking only; message history lives in MongoDB.
  const rooms = {};

  io.on('connection', (socket) => {
    // Rooms this socket has been authorized into — avoids a DB round-trip per message.
    const joinedRooms = new Set();

    socket.on('joinRoom', async ({ roomId }) => {
      try {
        const room = await DebateRoom.findById(roomId).lean();
        if (!room) {
          return socket.emit('error', { message: 'Room not found.' });
        }

        const isParticipant = room.participants.some(p => p.toString() === socket.user.id);
        if (!isParticipant) {
          return socket.emit('error', { message: 'You are not a registered participant.' });
        }

        socket.join(roomId);
        joinedRooms.add(roomId.toString());

        if (!rooms[roomId]) {
          rooms[roomId] = { participants: [] };
        }
        if (!rooms[roomId].participants.some(p => p.id === socket.user.id)) {
          rooms[roomId].participants.push(socket.user);
        }

        io.to(roomId).emit('roomUpdate', { participants: rooms[roomId].participants });
      } catch {
        socket.emit('error', { message: 'Server error joining room.' });
      }
    });

    socket.on('sendMessage', async ({ roomId, content }) => {
      try {
        if (!joinedRooms.has(String(roomId))) {
          return socket.emit('error', { message: 'Join the room before sending messages.' });
        }
        if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) {
          return socket.emit('error', { message: 'Message must be 1-2000 characters.' });
        }

        const newMessage = await Message.create({
          debateId: roomId,
          content: content.trim(),
          sender: socket.user.id,
        });
        await newMessage.populate('sender', 'fullName username avatarUrl');

        io.to(roomId).emit('receiveMessage', newMessage);
      } catch {
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (rooms[roomId]) {
          rooms[roomId].participants = rooms[roomId].participants.filter(p => p.id !== socket.user.id);
          if (rooms[roomId].participants.length === 0) {
            delete rooms[roomId];
          } else {
            io.to(roomId).emit('roomUpdate', { participants: rooms[roomId].participants });
          }
        }
      }
    });
  });

  return io;
}
