const Message = require('../../models/Message');
const User = require('../../models/User');

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

// POST /api/messages  { friendId, text, type? }
const sendMessage = async (req, res) => {
  try {
    const { friendId, text, type = 'text' } = req.body;
    if (!friendId || !text) return res.status(400).json({ message: '参数缺失' });

    // 校验是否为好友
    const me = await User.findById(req.user.id).select('friends');
    if (!me.friends.map(String).includes(friendId)) {
      return res.status(403).json({ message: '对方不是你的好友' });
    }

    const conversationId = makeConvId(req.user.id, friendId);
    const msg = await Message.create({ conversationId, senderId: req.user.id, text, type });
    res.json({ message: formatMsg(msg) });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ message: '发送失败' });
  }
};

// GET /api/messages/:friendId?since=ISODateString
const getMessages = async (req, res) => {
  try {
    const { friendId } = req.params;
    const { since } = req.query;
    const conversationId = makeConvId(req.user.id, friendId);

    const query = { conversationId };
    if (since) query.createdAt = { $gt: new Date(since) };

    const msgs = await Message.find(query).sort({ createdAt: 1 }).limit(200);
    res.json({ messages: msgs.map(formatMsg) });
  } catch (err) {
    res.status(500).json({ message: '获取消息失败' });
  }
};

module.exports = { sendMessage, getMessages };
