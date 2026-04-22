const Group = require('../../models/Group');
const GroupMessage = require('../../models/GroupMessage');
const { emitToUser, emitToRoom } = require('../../socket/emit');

// Helper: format a group document for API response
function formatGroup(group) {
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    color: group.color,
    ownerId: group.owner.toString(),
    adminIds: group.admins.map((a) => a.toString()),
    members: (group.members || []).map((m) => {
      if (m && typeof m === 'object' && m._id) {
        return {
          id: m._id.toString(),
          userId: m.userId || '',
          username: m.username || '',
          avatar: m.avatar || '',
        };
      }
      return { id: m.toString(), userId: '', username: '', avatar: '' };
    }),
    announcement: group.announcement || '',
    isMuted: group.isMuted || false,
    createdAt: group.createdAt,
  };
}

// GET /api/groups
async function getGroups(req, res) {
  try {
    const userId = req.user.id;
    const groups = await Group.find({
      $or: [{ owner: userId }, { members: userId }],
    }).populate('members', 'userId username avatar');

    res.json({ groups: groups.map(formatGroup) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/groups
async function createGroup(req, res) {
  try {
    const userId = req.user.id;
    const { name, description, color, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: '群名称不能为空' });
    }
    if (!Array.isArray(memberIds) || memberIds.length > 200) {
      return res.status(400).json({ message: '成员数量不合法（最多200人）' });
    }

    // Deduplicate and ensure creator is included
    const allMembers = [...new Set([...memberIds, userId])];

    const group = await Group.create({
      name: name.trim(),
      description: description || '',
      color: color || '#667eea',
      owner: userId,
      admins: [],
      members: allMembers,
    });

    await group.populate('members', 'userId username avatar');
    res.status(201).json({ group: formatGroup(group) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/groups/:id/messages
async function getGroupMessages(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ message: '无权限' });

    const query = { group: id };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await GroupMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(Number(limit))
      .populate('sender', 'userId username avatar');

    res.json({
      messages: messages.map((msg) => ({
        id: msg._id.toString(),
        groupId: id,
        sender: {
          id: msg.sender._id.toString(),
          userId: msg.sender.userId,
          username: msg.sender.username,
          avatar: msg.sender.avatar || '',
        },
        content: msg.content,
        type: msg.type,
        mentionedUsers: (msg.mentionedUsers || []).map((u) => u.toString()),
        isRecalled: msg.isRecalled,
        createdAt: msg.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/groups/:id
async function updateGroup(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, announcement, isMuted, color } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isOwner = group.owner.toString() === userId.toString();
    const isAdmin = group.admins.some((a) => a.toString() === userId.toString());

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '无权限' });
    }

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (announcement !== undefined) group.announcement = announcement;
    if (isMuted !== undefined) group.isMuted = isMuted;
    // Only owner can change color
    if (color !== undefined && isOwner) group.color = color;

    await group.save();
    await group.populate('members', 'userId username avatar');
    res.json({ group: formatGroup(group) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/groups/:id/announcement
async function setGroupAnnouncement(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { announcement } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isOwner = group.owner.toString() === userId.toString();
    const isAdmin = group.admins.some((a) => a.toString() === userId.toString());
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限' });

    group.announcement = announcement || '';
    await group.save();
    res.json({ announcement: group.announcement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/groups/:id/members/:userId
async function kickMember(req, res) {
  try {
    const operatorId = req.user.id;
    const { id, userId: targetUserId } = req.params;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isOwner = group.owner.toString() === operatorId.toString();
    const isAdmin = group.admins.some((a) => a.toString() === operatorId.toString());
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限' });

    // Owner cannot be kicked
    if (group.owner.toString() === targetUserId) {
      return res.status(400).json({ message: '群主不能被踢出' });
    }

    group.members = group.members.filter((m) => m.toString() !== targetUserId);
    group.admins = group.admins.filter((a) => a.toString() !== targetUserId);
    await group.save();

    emitToUser(targetUserId, 'group:kicked', { groupId: id });
    res.json({ message: '已踢出' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/groups/:id/mute
async function setMuted(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { isMuted } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isOwner = group.owner.toString() === userId.toString();
    const isAdmin = group.admins.some((a) => a.toString() === userId.toString());
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限' });

    group.isMuted = !!isMuted;
    await group.save();
    res.json({ isMuted: group.isMuted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/groups/:id/leave
async function leaveGroup(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    if (group.owner.toString() === userId.toString()) {
      return res.status(400).json({ message: '群主不能退出，请先转让群主' });
    }

    group.members = group.members.filter((m) => m.toString() !== userId.toString());
    group.admins = group.admins.filter((a) => a.toString() !== userId.toString());
    await group.save();
    res.json({ message: '已退出' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/groups/:id
async function dissolveGroup(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: '只有群主可以解散群' });
    }

    await GroupMessage.deleteMany({ group: id });
    await Group.findByIdAndDelete(id);

    emitToRoom(`group:${id}`, 'group:dissolved', { groupId: id });
    res.json({ message: '群已解散' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/groups/:id/invite
async function inviteMembers(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: '参数错误' });
    }

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: '群不存在' });

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ message: '无权限' });

    await Group.findByIdAndUpdate(id, { $addToSet: { members: { $each: memberIds } } });
    res.json({ message: `已邀请 ${memberIds.length} 人` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getGroups,
  createGroup,
  getGroupMessages,
  updateGroup,
  setGroupAnnouncement,
  kickMember,
  setMuted,
  leaveGroup,
  dissolveGroup,
  inviteMembers,
};
