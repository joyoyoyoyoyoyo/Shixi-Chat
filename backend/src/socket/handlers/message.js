const { createMessage } = require('../../services/messageService');
const { emitToUser } = require('../emit');

function registerMessageHandlers(socket) {
  // message:send { friendId, text, type? }  → ack({ message } | { error })
  socket.on('message:send', async (payload, ack) => {
    try {
      const { friendId, text, type } = payload ?? {};
      const { message, conversationId } = await createMessage({
        senderId: socket.data.userId,
        friendId,
        text,
        type,
      });
      // 双方房间都推 → 多端同步 + 对方实时收到
      emitToUser(socket.data.userId, 'message:new', { conversationId, message });
      emitToUser(friendId, 'message:new', { conversationId, message });
      if (typeof ack === 'function') ack({ message, conversationId });
    } catch (err) {
      if (typeof ack === 'function') ack({ error: err.message || '发送失败' });
    }
  });
}

module.exports = { registerMessageHandlers };
