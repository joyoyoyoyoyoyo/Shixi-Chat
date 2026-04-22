const { emitToUser } = require('../emit');

// 连接态内缓存 friends 列表,避免每次 typing 都查库;但接受/拒绝好友请求会更新它。
// 为了简单稳妥,typing 事件里按 socket.data.friends 白名单校验即可。
function registerTypingHandlers(socket) {
  socket.on('typing:start', ({ friendId } = {}) => {
    if (!friendId || !isFriend(socket, friendId)) return;
    emitToUser(friendId, 'typing:update', { fromUserId: socket.data.userId, typing: true });
  });

  socket.on('typing:stop', ({ friendId } = {}) => {
    if (!friendId || !isFriend(socket, friendId)) return;
    emitToUser(friendId, 'typing:update', { fromUserId: socket.data.userId, typing: false });
  });
}

function isFriend(socket, friendId) {
  const set = socket.data.friendSet;
  return !!set && set.has(friendId.toString());
}

module.exports = { registerTypingHandlers };
