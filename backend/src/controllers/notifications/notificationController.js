const Notification = require('../../models/Notification');
const Forum = require('../../models/Forum');
const ForumJoinRequest = require('../../models/ForumJoinRequest');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('fromUser', 'username avatar')
      .lean();

    const result = notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      fromUser: {
        id: n.fromUser._id.toString(),
        username: n.fromUser.username || '',
        avatar: n.fromUser.avatar || '',
      },
      forumId: n.forum ? n.forum.toString() : '',
      topicId: n.topic ? n.topic.toString() : '',
      topicTitle: n.topicTitle || '',
      commentContent: n.commentContent || '',
      read: n.read,
      createdAt: n.createdAt,
    }));

    res.json({ notifications: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifCount = await Notification.countDocuments({ recipient: userId, read: false });

    // Find forums where user is owner or admin
    const managedForums = await Forum.find({
      $or: [{ owner: userId }, { admins: userId }],
    }).select('_id').lean();

    const forumIds = managedForums.map((f) => f._id);
    const requestCount = forumIds.length > 0
      ? await ForumJoinRequest.countDocuments({ forum: { $in: forumIds }, status: 'pending' })
      : 0;

    res.json({ notifCount, requestCount, total: notifCount + requestCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: userId },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/notifications/management
const getManagementRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const managedForums = await Forum.find({
      $or: [{ owner: userId }, { admins: userId }],
    }).select('_id').lean();

    const forumIds = managedForums.map((f) => f._id);

    if (forumIds.length === 0) {
      return res.json({ requests: [] });
    }

    const requests = await ForumJoinRequest.find({
      forum: { $in: forumIds },
      status: 'pending',
    })
      .populate('user', 'userId username avatar')
      .populate('forum', 'name color')
      .lean();

    const result = requests.map((r) => ({
      id: r._id.toString(),
      forum: {
        id: r.forum._id.toString(),
        name: r.forum.name,
        color: r.forum.color,
      },
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

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  getManagementRequests,
};
