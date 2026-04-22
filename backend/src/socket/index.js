const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { setIo, roomFor } = require('./emit');
const { registerMessageHandlers } = require('./handlers/message');
const { registerTypingHandlers } = require('./handlers/typing');
const {
  handlePresenceConnect,
  handlePresenceDisconnect,
} = require('./handlers/presence');
const { registerGroupHandlers } = require('./handlers/group');
const Group = require('../models/Group');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    },
  });

  // 握手鉴权:与 REST 同一套 JWT
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('unauthorized'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(roomFor(userId));

    // 自动加入用户所在的所有群 room，无需客户端主动发 join_rooms
    try {
      const groups = await Group.find({ members: userId }).select('_id').lean();
      groups.forEach((g) => socket.join(`group:${g._id.toString()}`));
    } catch (err) {
      console.error('auto-join groups error:', err);
    }

    try {
      await handlePresenceConnect(socket);
    } catch (err) {
      console.error('presence connect error:', err);
    }

    registerMessageHandlers(socket);
    registerTypingHandlers(socket);
    registerGroupHandlers(socket);

    socket.on('disconnect', () => {
      handlePresenceDisconnect(socket);
    });
  });

  setIo(io);
  console.log('🔌 Socket.io 实时通信已启用');
  return io;
}

module.exports = { initSocket };
