// Socket 事件对外出口。REST controller 可通过 emitToUser 往在线用户推事件。
// 连接态由 ./index.js 维护,这里只暴露纯函数。
let ioRef = null;
const onlineUsers = new Map(); // userId -> Set<socketId>

function setIo(io) {
  ioRef = io;
}

function roomFor(userId) {
  return `user:${userId.toString()}`;
}

function addConnection(userId, socketId) {
  const key = userId.toString();
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
  return onlineUsers.get(key).size === 1; // true 表示首次上线
}

function removeConnection(userId, socketId) {
  const key = userId.toString();
  const set = onlineUsers.get(key);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(key);
    return true; // 全下线
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId.toString());
}

function onlineFrom(userIds) {
  return userIds.map(String).filter((id) => onlineUsers.has(id));
}

function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  ioRef.to(roomFor(userId)).emit(event, payload);
}

function emitToRoom(room, event, payload) {
  if (!ioRef) return;
  ioRef.to(room).emit(event, payload);
}

module.exports = {
  setIo,
  roomFor,
  addConnection,
  removeConnection,
  isOnline,
  onlineFrom,
  emitToUser,
  emitToRoom,
};
