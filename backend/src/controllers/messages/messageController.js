const { createMessage } = require('../../services/messageService');
const { emitToUser } = require('../../socket/emit');

// POST /api/messages  { friendId, text, type? }
const sendMessage = async (req, res) => {
  try {
    const { friendId, text, type } = req.body;
    const { message, conversationId } = await createMessage({
      senderId: req.user.id,
      friendId,
      text,
      type,
    });

    // 同步推送给双方在线 socket(若当前就是 socket 用户,emit 路径不会走到这里)
    emitToUser(req.user.id, 'message:new', { conversationId, message });
    emitToUser(friendId, 'message:new', { conversationId, message });

    res.json({ message });
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ message: err.message });
    if (err.code === 'NOT_FRIEND') return res.status(403).json({ message: err.message });
    console.error('sendMessage error:', err);
    res.status(500).json({ message: '发送失败' });
  }
};

// GET /api/messages/:friendId?since=ISODateString
const getMessages = async (req, res) => {
  try {
    const Message = require('../../models/Message');
    const { formatMsg, makeConvId } = require('../../services/messageService');
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
