const User = require('../../models/User');
const FriendRequest = require('../../models/FriendRequest');

// GET /api/friends/search?q=
// Search by 11-digit userId or email
const searchUser = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: '请输入搜索内容' });

    const user = await User.findOne({
      $or: [{ userId: q.trim() }, { email: q.trim().toLowerCase() }],
    }).select('_id userId username avatar');

    if (!user) return res.status(404).json({ message: '未找到该用户' });
    if (user._id.toString() === req.user.id)
      return res.status(400).json({ message: '不能添加自己' });

    // Check relationship
    const me = await User.findById(req.user.id).select('friends');
    const isFriend = me.friends.map(String).includes(user._id.toString());

    const pending = await FriendRequest.findOne({
      from: req.user.id,
      to: user._id,
      status: 'pending',
    });

    res.json({
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
      },
      isFriend,
      isPending: !!pending,
    });
  } catch (err) {
    console.error('searchUser error:', err);
    res.status(500).json({ message: '搜索失败' });
  }
};

// POST /api/friends/request  { toUserId: mongoId }
const sendRequest = async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ message: '缺少目标用户' });
    if (toUserId === req.user.id) return res.status(400).json({ message: '不能添加自己' });

    const target = await User.findById(toUserId);
    if (!target) return res.status(404).json({ message: '用户不存在' });

    const me = await User.findById(req.user.id).select('friends');
    if (me.friends.map(String).includes(toUserId))
      return res.status(400).json({ message: '已经是好友了' });

    // Upsert request
    await FriendRequest.findOneAndUpdate(
      { from: req.user.id, to: toUserId },
      { status: 'pending', createdAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: '好友申请已发送' });
  } catch (err) {
    console.error('sendRequest error:', err);
    res.status(500).json({ message: '发送失败' });
  }
};

// GET /api/friends/requests — incoming pending requests
const getRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      to: req.user.id,
      status: 'pending',
    })
      .populate('from', '_id userId username avatar')
      .sort({ createdAt: -1 });

    // 显式格式化，避免 Mongoose virtual id 不进 JSON 的问题
    res.json({
      requests: requests.map((r) => ({
        id: r._id.toString(),
        from: {
          id: r.from._id.toString(),
          userId: r.from.userId,
          username: r.from.username,
          avatar: r.from.avatar,
        },
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: '获取申请失败' });
  }
};

// POST /api/friends/respond  { requestId, action: 'accept'|'reject' }
const respondRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body;
    const request = await FriendRequest.findById(requestId);

    if (!request || request.to.toString() !== req.user.id)
      return res.status(404).json({ message: '申请不存在' });

    if (action === 'accept') {
      request.status = 'accepted';
      await request.save();

      // Add each other as friends
      await User.findByIdAndUpdate(req.user.id, { $addToSet: { friends: request.from } });
      await User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.user.id } });

      res.json({ message: '已接受好友申请' });
    } else {
      request.status = 'rejected';
      await request.save();
      res.json({ message: '已拒绝好友申请' });
    }
  } catch (err) {
    console.error('respondRequest error:', err);
    res.status(500).json({ message: '操作失败' });
  }
};

// GET /api/friends — get my friend list
const getFriends = async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
      .populate('friends', '_id userId username avatar')
      .select('friends');

    res.json({
      friends: me.friends.map((f) => ({
        id: f._id.toString(),
        userId: f.userId,
        username: f.username,
        avatar: f.avatar,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: '获取好友列表失败' });
  }
};

// DELETE /api/friends/:friendId
const deleteFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    await User.findByIdAndUpdate(req.user.id, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user.id } });
    res.json({ message: '已删除好友' });
  } catch (err) {
    res.status(500).json({ message: '删除失败' });
  }
};

module.exports = { searchUser, sendRequest, getRequests, respondRequest, getFriends, deleteFriend };
