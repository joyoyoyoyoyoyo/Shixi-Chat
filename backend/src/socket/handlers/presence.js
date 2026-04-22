const User = require('../../models/User');
const {
  addConnection,
  removeConnection,
  onlineFrom,
  emitToUser,
} = require('../emit');

// 连接时加载好友列表、加入房间、广播上线、推送快照
async function handlePresenceConnect(socket) {
  const userId = socket.data.userId;
  const me = await User.findById(userId).select('friends');
  const friends = (me?.friends || []).map(String);
  socket.data.friends = friends;
  socket.data.friendSet = new Set(friends);

  const firstConnection = addConnection(userId, socket.id);

  // 先把当前在线的好友快照推给自己
  socket.emit('presence:snapshot', { onlineIds: onlineFrom(friends) });

  // 首次上线 → 通知所有好友
  if (firstConnection) {
    for (const fid of friends) {
      emitToUser(fid, 'presence:update', { userId: userId.toString(), online: true });
    }
  }
}

function handlePresenceDisconnect(socket) {
  const userId = socket.data.userId;
  if (!userId) return;
  const fullyOffline = removeConnection(userId, socket.id);
  if (!fullyOffline) return;

  const friends = socket.data.friends || [];
  for (const fid of friends) {
    emitToUser(fid, 'presence:update', { userId: userId.toString(), online: false });
  }
}

module.exports = { handlePresenceConnect, handlePresenceDisconnect };
