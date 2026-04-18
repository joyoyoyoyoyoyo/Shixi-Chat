const Forum = require('../../models/Forum');
const ForumJoinRequest = require('../../models/ForumJoinRequest');
const User = require('../../models/User');

function formatForum(forum, userId) {
  const ownerId = forum.owner._id ? forum.owner._id.toString() : forum.owner.toString();
  const adminIds = (forum.admins || []).map((a) => (a._id ? a._id.toString() : a.toString()));
  const memberIds = (forum.members || []).map((m) => (m._id ? m._id.toString() : m.toString()));
  const uid = userId.toString();

  return {
    id: forum._id.toString(),
    name: forum.name,
    description: forum.description,
    industry: forum.industry,
    tags: forum.tags || [],
    image: forum.image,
    color: forum.color,
    ownerId,
    adminIds,
    memberCount: memberIds.length,
    isPrivate: forum.isPrivate,
    isMember: memberIds.includes(uid),
    isOwner: ownerId === uid,
    isAdmin: adminIds.includes(uid),
    isPending: false, // will be set after checking requests
    createdAt: forum.createdAt,
  };
}

// GET /api/forums
const getForums = async (req, res) => {
  try {
    const userId = req.user.id;
    const forums = await Forum.find().lean();

    // Get pending requests for this user
    const pendingReqs = await ForumJoinRequest.find({ user: userId, status: 'pending' }).lean();
    const pendingForumIds = new Set(pendingReqs.map((r) => r.forum.toString()));

    const result = forums.map((forum) => {
      const ownerId = forum.owner.toString();
      const adminIds = (forum.admins || []).map((a) => a.toString());
      const memberIds = (forum.members || []).map((m) => m.toString());
      const uid = userId.toString();

      return {
        id: forum._id.toString(),
        name: forum.name,
        description: forum.description,
        industry: forum.industry,
        tags: forum.tags || [],
        image: forum.image || '',
        color: forum.color || '#667eea',
        ownerId,
        adminIds,
        memberCount: memberIds.length,
        isPrivate: forum.isPrivate,
        isMember: memberIds.includes(uid),
        isOwner: ownerId === uid,
        isAdmin: adminIds.includes(uid),
        isPending: pendingForumIds.has(forum._id.toString()),
        createdAt: forum.createdAt,
      };
    });

    res.json({ forums: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/forums
const createForum = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, industry, tags, color, isPrivate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: '论坛名称不能为空' });
    }

    const forum = new Forum({
      name: name.trim(),
      description: description || '',
      industry: industry || '其他',
      tags: tags || [],
      color: color || '#667eea',
      isPrivate: isPrivate === true || isPrivate === 'true',
      owner: userId,
      admins: [],
      members: [userId],
    });

    await forum.save();

    const uid = userId.toString();
    const result = {
      id: forum._id.toString(),
      name: forum.name,
      description: forum.description,
      industry: forum.industry,
      tags: forum.tags || [],
      image: forum.image || '',
      color: forum.color,
      ownerId: uid,
      adminIds: [],
      memberCount: 1,
      isPrivate: forum.isPrivate,
      isMember: true,
      isOwner: true,
      isAdmin: false,
      isPending: false,
      createdAt: forum.createdAt,
    };

    res.status(201).json({ forum: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/forums/:id
const getForumDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id).lean();
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const pendingReq = await ForumJoinRequest.findOne({ forum: forum._id, user: userId, status: 'pending' }).lean();

    const ownerId = forum.owner.toString();
    const adminIds = (forum.admins || []).map((a) => a.toString());
    const memberIds = (forum.members || []).map((m) => m.toString());
    const uid = userId.toString();

    res.json({
      forum: {
        id: forum._id.toString(),
        name: forum.name,
        description: forum.description,
        industry: forum.industry,
        tags: forum.tags || [],
        image: forum.image || '',
        color: forum.color || '#667eea',
        ownerId,
        adminIds,
        memberCount: memberIds.length,
        isPrivate: forum.isPrivate,
        isMember: memberIds.includes(uid),
        isOwner: ownerId === uid,
        isAdmin: adminIds.includes(uid),
        isPending: !!pendingReq,
        createdAt: forum.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/forums/:id
const updateForum = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });
    if (forum.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: '只有群主才能修改论坛信息' });
    }

    const { name, description, isPrivate } = req.body;
    if (name !== undefined) forum.name = name;
    if (description !== undefined) forum.description = description;
    if (isPrivate !== undefined) forum.isPrivate = isPrivate;

    await forum.save();

    const uid = userId.toString();
    const adminIds = (forum.admins || []).map((a) => a.toString());
    const memberIds = (forum.members || []).map((m) => m.toString());

    res.json({
      forum: {
        id: forum._id.toString(),
        name: forum.name,
        description: forum.description,
        industry: forum.industry,
        tags: forum.tags || [],
        image: forum.image || '',
        color: forum.color,
        ownerId: forum.owner.toString(),
        adminIds,
        memberCount: memberIds.length,
        isPrivate: forum.isPrivate,
        isMember: memberIds.includes(uid),
        isOwner: true,
        isAdmin: false,
        isPending: false,
        createdAt: forum.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/forums/:id/join
const joinForum = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const memberIds = forum.members.map((m) => m.toString());
    if (memberIds.includes(userId.toString())) {
      return res.status(400).json({ message: '已加入该论坛' });
    }

    if (!forum.isPrivate) {
      await Forum.findByIdAndUpdate(forum._id, { $addToSet: { members: userId } });
      return res.json({ message: '加入成功' });
    } else {
      // Private: create join request
      await ForumJoinRequest.findOneAndUpdate(
        { forum: forum._id, user: userId },
        { status: 'pending', createdAt: new Date() },
        { upsert: true, new: true }
      );
      return res.json({ message: '申请已发送' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/forums/:id/leave
const leaveForum = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    if (forum.owner.toString() === userId.toString()) {
      return res.status(400).json({ message: '群主不能退出，请先转让或解散论坛' });
    }

    await Forum.findByIdAndUpdate(forum._id, { $pull: { members: userId, admins: userId } });
    res.json({ message: '已退出论坛' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/forums/:id/members
const getMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id).populate('members', 'userId username avatar').populate('owner admins').lean();
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const memberIds = (forum.members || []).map((m) => m._id.toString());
    if (!memberIds.includes(userId.toString())) {
      return res.status(403).json({ message: '需要是论坛成员才能查看' });
    }

    // Get current user's friends
    const currentUser = await User.findById(userId).lean();
    const friendIds = new Set((currentUser.friends || []).map((f) => f.toString()));

    const ownerId = forum.owner._id ? forum.owner._id.toString() : forum.owner.toString();
    const adminIds = new Set((forum.admins || []).map((a) => (a._id ? a._id.toString() : a.toString())));

    const members = (forum.members || []).map((m) => {
      const mid = m._id.toString();
      let role = 'member';
      if (mid === ownerId) role = 'owner';
      else if (adminIds.has(mid)) role = 'admin';

      return {
        id: mid,
        userId: m.userId || '',
        username: m.username || '',
        avatar: m.avatar || '',
        role,
        isFriend: friendIds.has(mid),
      };
    });

    res.json({ members });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/forums/:id/admins/:userId
const setAdmin = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });
    if (forum.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: '只有群主才能设置管理员' });
    }

    const targetId = req.params.userId;
    const memberIds = forum.members.map((m) => m.toString());
    if (!memberIds.includes(targetId)) {
      return res.status(400).json({ message: '该用户不是论坛成员' });
    }

    await Forum.findByIdAndUpdate(forum._id, { $addToSet: { admins: targetId } });
    res.json({ message: '设置成功' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/forums/:id/admins/:userId
const removeAdmin = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });
    if (forum.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: '只有群主才能移除管理员' });
    }

    await Forum.findByIdAndUpdate(forum._id, { $pull: { admins: req.params.userId } });
    res.json({ message: '已移除管理员' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/forums/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const ownerId = forum.owner.toString();
    const adminIds = forum.admins.map((a) => a.toString());
    const isOwner = ownerId === userId.toString();
    const isAdmin = adminIds.includes(userId.toString());

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '权限不足' });
    }

    const targetId = req.params.userId;
    if (targetId === ownerId) {
      return res.status(400).json({ message: '不能移除群主' });
    }

    await Forum.findByIdAndUpdate(forum._id, { $pull: { members: targetId, admins: targetId } });
    res.json({ message: '已移除成员' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/forums/:id/requests
const getJoinRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const ownerId = forum.owner.toString();
    const adminIds = forum.admins.map((a) => a.toString());
    const uid = userId.toString();

    if (ownerId !== uid && !adminIds.includes(uid)) {
      return res.status(403).json({ message: '权限不足' });
    }

    const requests = await ForumJoinRequest.find({ forum: forum._id, status: 'pending' })
      .populate('user', 'userId username avatar')
      .lean();

    const result = requests.map((r) => ({
      id: r._id.toString(),
      user: {
        id: r.user._id.toString(),
        userId: r.user.userId || '',
        username: r.user.username || '',
        avatar: r.user.avatar || '',
      },
      createdAt: r.createdAt,
    }));

    res.json({ requests: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/forums/:id/requests/:reqId
const respondJoinRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const ownerId = forum.owner.toString();
    const adminIds = forum.admins.map((a) => a.toString());
    const uid = userId.toString();

    if (ownerId !== uid && !adminIds.includes(uid)) {
      return res.status(403).json({ message: '权限不足' });
    }

    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: '无效操作' });
    }

    const joinReq = await ForumJoinRequest.findById(req.params.reqId);
    if (!joinReq) return res.status(404).json({ message: '申请不存在' });

    if (action === 'approve') {
      joinReq.status = 'approved';
      await joinReq.save();
      await Forum.findByIdAndUpdate(forum._id, { $addToSet: { members: joinReq.user } });
    } else {
      joinReq.status = 'rejected';
      await joinReq.save();
    }

    res.json({ message: action === 'approve' ? '已同意' : '已拒绝' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/forums/:id  (dissolve — owner only)
const dissolveForum = async (req, res) => {
  try {
    const userId = req.user.id;
    const forum = await Forum.findById(req.params.id);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });
    if (forum.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: '只有群主才能解散论坛' });
    }

    const Topic   = require('../../models/Topic');
    const Comment = require('../../models/Comment');

    // Delete all related data
    const topics = await Topic.find({ forum: forum._id }).select('_id').lean();
    const topicIds = topics.map((t) => t._id);
    await Comment.deleteMany({ topic: { $in: topicIds } });
    await Topic.deleteMany({ forum: forum._id });
    await ForumJoinRequest.deleteMany({ forum: forum._id });
    await Forum.findByIdAndDelete(forum._id);

    res.json({ message: '论坛已解散' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getForums,
  createForum,
  getForumDetail,
  updateForum,
  joinForum,
  leaveForum,
  getMembers,
  setAdmin,
  removeAdmin,
  removeMember,
  getJoinRequests,
  respondJoinRequest,
  dissolveForum,
};
