const GroupMessage = require('../../models/GroupMessage');
const Group = require('../../models/Group');
const { emitToRoom } = require('../emit');

function registerGroupHandlers(socket) {
  const userId = socket.data.userId;

  // 加入所有群房间
  // group:join_rooms { groupIds: string[] }
  socket.on('group:join_rooms', async ({ groupIds }) => {
    if (!Array.isArray(groupIds)) return;
    groupIds.forEach((id) => socket.join(`group:${id}`));
  });

  // 发消息: group:message:send { groupId, content, mentionedUserIds? }
  // ack: { message } | { error }
  socket.on('group:message:send', async (payload, ack) => {
    try {
      const { groupId, content, mentionedUserIds } = payload ?? {};
      if (!content?.trim()) {
        if (typeof ack === 'function') ack({ error: '消息不能为空' });
        return;
      }
      const group = await Group.findById(groupId);
      if (!group) { if (typeof ack === 'function') ack({ error: '群不存在' }); return; }
      // 检查是否为成员
      const isMember = group.members.some((m) => m.toString() === userId.toString());
      if (!isMember) { if (typeof ack === 'function') ack({ error: '不是群成员' }); return; }
      // 禁言检查
      if (group.isMuted) {
        const isOwner = group.owner.toString() === userId.toString();
        const isAdmin = group.admins.some((a) => a.toString() === userId.toString());
        if (!isOwner && !isAdmin) { if (typeof ack === 'function') ack({ error: '当前全员禁言' }); return; }
      }
      const msg = await GroupMessage.create({
        group: groupId,
        sender: userId,
        content: content.trim(),
        mentionedUsers: mentionedUserIds ?? [],
      });
      await msg.populate('sender', 'userId username avatar');
      const out = {
        id: msg._id.toString(),
        groupId,
        sender: {
          id: msg.sender._id.toString(),
          userId: msg.sender.userId,
          username: msg.sender.username,
          avatar: msg.sender.avatar || '',
        },
        content: msg.content,
        type: 'text',
        mentionedUsers: mentionedUserIds ?? [],
        isRecalled: false,
        createdAt: msg.createdAt,
      };
      // 广播给群所有成员
      emitToRoom(`group:${groupId}`, 'group:message:new', out);
      if (typeof ack === 'function') ack({ message: out });
    } catch (err) {
      if (typeof ack === 'function') ack({ error: err.message });
    }
  });

  // 撤回消息: group:message:recall { messageId, groupId }
  socket.on('group:message:recall', async (payload, ack) => {
    try {
      const { messageId, groupId } = payload ?? {};
      const msg = await GroupMessage.findById(messageId);
      if (!msg) { if (typeof ack === 'function') ack({ error: '消息不存在' }); return; }
      if (msg.sender.toString() !== userId.toString()) {
        if (typeof ack === 'function') ack({ error: '只能撤回自己的消息' }); return;
      }
      // 2分钟限制
      if (Date.now() - new Date(msg.createdAt).getTime() > 2 * 60 * 1000) {
        if (typeof ack === 'function') ack({ error: '超过2分钟，无法撤回' }); return;
      }
      msg.isRecalled = true;
      msg.recalledAt = new Date();
      await msg.save();
      emitToRoom(`group:${groupId}`, 'group:message:recalled', { messageId, groupId });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (typeof ack === 'function') ack({ error: err.message });
    }
  });
}

module.exports = { registerGroupHandlers };
