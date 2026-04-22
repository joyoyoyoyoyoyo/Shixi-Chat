const Message = require('../models/Message');
const User = require('../models/User');

function formatMsg(m) {
  return {
    id: m._id.toString(),
    senderId: m.senderId.toString(),
    text: m.text,
    type: m.type,
    time: new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    createdAt: m.createdAt,
  };
}

// conversationId 规则: [userAId, userBId].sort().join('_')
function makeConvId(a, b) {
  return [a.toString(), b.toString()].sort().join('_');
}

async function assertFriendship(userId, friendId) {
  const me = await User.findById(userId).select('friends');
  if (!me) throw Object.assign(new Error('用户不存在'), { code: 'NOT_FOUND' });
  if (!me.friends.map(String).includes(friendId.toString())) {
    throw Object.assign(new Error('对方不是你的好友'), { code: 'NOT_FRIEND' });
  }
}

async function createMessage({ senderId, friendId, text, type = 'text' }) {
  if (!friendId || !text) {
    throw Object.assign(new Error('参数缺失'), { code: 'BAD_REQUEST' });
  }
  await assertFriendship(senderId, friendId);

  const conversationId = makeConvId(senderId, friendId);
  const msg = await Message.create({ conversationId, senderId, text, type });
  return { message: formatMsg(msg), conversationId };
}

module.exports = { createMessage, formatMsg, makeConvId, assertFriendship };
