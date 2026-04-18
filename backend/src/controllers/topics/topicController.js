const Topic = require('../../models/Topic');
const Comment = require('../../models/Comment');
const Forum = require('../../models/Forum');

// GET /api/topics?forumId=
const getTopics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { forumId } = req.query;
    if (!forumId) return res.status(400).json({ message: 'forumId 必填' });

    const topics = await Topic.find({ forum: forumId })
      .sort({ createdAt: -1 })
      .populate('creator', 'userId username avatar')
      .lean();

    const result = topics.map((t) => ({
      id: t._id.toString(),
      forumId: t.forum.toString(),
      title: t.title,
      content: t.content || '',
      images: t.images || [],
      creator: {
        id: t.creator._id.toString(),
        username: t.creator.username || '',
        avatar: t.creator.avatar || '',
      },
      likeCount: (t.likes || []).length,
      isLiked: (t.likes || []).some((l) => l.toString() === userId.toString()),
      commentCount: t.commentCount || 0,
      isPinned: t.isPinned || false,
      createdAt: t.createdAt,
    }));

    res.json({ topics: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/topics (multipart/form-data)
const createTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { forumId, title, content } = req.body;

    if (!forumId || !title) {
      return res.status(400).json({ message: 'forumId 和 title 必填' });
    }

    const forum = await Forum.findById(forumId);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const memberIds = forum.members.map((m) => m.toString());
    if (!memberIds.includes(userId.toString())) {
      return res.status(403).json({ message: '需要是论坛成员才能发帖' });
    }

    const images = (req.files || []).map((f) => f.filename);

    const topic = new Topic({
      forum: forumId,
      creator: userId,
      title: title.trim(),
      content: content || '',
      images,
    });

    await topic.save();
    await topic.populate('creator', 'userId username avatar');

    res.status(201).json({
      topic: {
        id: topic._id.toString(),
        forumId: topic.forum.toString(),
        title: topic.title,
        content: topic.content,
        images: topic.images,
        creator: {
          id: topic.creator._id.toString(),
          username: topic.creator.username || '',
          avatar: topic.creator.avatar || '',
        },
        likeCount: 0,
        isLiked: false,
        commentCount: 0,
        createdAt: topic.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/topics/:id
const deleteTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: '话题不存在' });

    const forum = await Forum.findById(topic.forum);
    const ownerId = forum ? forum.owner.toString() : '';
    const adminIds = forum ? forum.admins.map((a) => a.toString()) : [];
    const uid = userId.toString();

    const isCreator = topic.creator.toString() === uid;
    const isOwner = ownerId === uid;
    const isAdmin = adminIds.includes(uid);

    if (!isCreator && !isOwner && !isAdmin) {
      return res.status(403).json({ message: '权限不足' });
    }

    await Comment.deleteMany({ topic: topic._id });
    await Topic.findByIdAndDelete(topic._id);

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/topics/:id/like
const likeTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: '话题不存在' });

    const likeIds = topic.likes.map((l) => l.toString());
    const isLiked = likeIds.includes(userId.toString());

    if (isLiked) {
      await Topic.findByIdAndUpdate(topic._id, { $pull: { likes: userId } });
    } else {
      await Topic.findByIdAndUpdate(topic._id, { $addToSet: { likes: userId } });
      // Create like notification
      const Notification = require('../../models/Notification');
      if (topic.creator.toString() !== userId.toString()) {
        await Notification.findOneAndUpdate(
          { recipient: topic.creator, type: 'like', fromUser: userId, topic: topic._id },
          { $set: { read: false, createdAt: new Date(), topicTitle: topic.title, forum: topic.forum } },
          { upsert: true }
        );
      }
    }

    const updatedTopic = await Topic.findById(topic._id).lean();
    res.json({
      isLiked: !isLiked,
      likeCount: (updatedTopic.likes || []).length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/topics/:id/comments
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ topic: req.params.id })
      .sort({ createdAt: 1 })
      .populate('creator', 'userId username avatar')
      .lean();

    const result = comments.map((c) => ({
      id: c._id.toString(),
      topicId: c.topic.toString(),
      creator: {
        id: c.creator._id.toString(),
        username: c.creator.username || '',
        avatar: c.creator.avatar || '',
      },
      content: c.content,
      createdAt: c.createdAt,
    }));

    res.json({ comments: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/topics/:id/comments
const createComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '评论内容不能为空' });
    }

    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: '话题不存在' });

    const forum = await Forum.findById(topic.forum);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });

    const memberIds = forum.members.map((m) => m.toString());
    if (!memberIds.includes(userId.toString())) {
      return res.status(403).json({ message: '需要是论坛成员才能评论' });
    }

    const comment = new Comment({
      topic: topic._id,
      forum: forum._id,
      creator: userId,
      content: content.trim(),
    });

    await comment.save();
    await comment.populate('creator', 'userId username avatar');

    // Increment commentCount
    await Topic.findByIdAndUpdate(topic._id, { $inc: { commentCount: 1 } });

    // Create comment notification
    const Notification = require('../../models/Notification');
    if (topic.creator.toString() !== userId.toString()) {
      await Notification.create({
        recipient: topic.creator,
        type: 'comment',
        fromUser: userId,
        topic: topic._id,
        topicTitle: topic.title,
        commentContent: content.trim().substring(0, 100),
        forum: topic.forum,
      });
    }

    res.status(201).json({
      comment: {
        id: comment._id.toString(),
        topicId: comment.topic.toString(),
        creator: {
          id: comment.creator._id.toString(),
          username: comment.creator.username || '',
          avatar: comment.creator.avatar || '',
        },
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/topics/:id/comments/:commentId
const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: '评论不存在' });

    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: '话题不存在' });

    const forum = await Forum.findById(topic.forum);
    const ownerId = forum ? forum.owner.toString() : '';
    const adminIds = forum ? forum.admins.map((a) => a.toString()) : [];
    const uid = userId.toString();

    const isCommentCreator = comment.creator.toString() === uid;
    const isTopicCreator = topic.creator.toString() === uid;
    const isOwner = ownerId === uid;
    const isAdmin = adminIds.includes(uid);

    if (!isCommentCreator && !isTopicCreator && !isOwner && !isAdmin) {
      return res.status(403).json({ message: '权限不足' });
    }

    await Comment.findByIdAndDelete(comment._id);
    await Topic.findByIdAndUpdate(topic._id, { $inc: { commentCount: -1 } });

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/topics/:id/pin
const pinTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: '话题不存在' });
    const forum = await Forum.findById(topic.forum);
    if (!forum) return res.status(404).json({ message: '论坛不存在' });
    const isOwner = forum.owner.toString() === userId.toString();
    const isAdmin = forum.admins.map((a) => a.toString()).includes(userId.toString());
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '权限不足' });
    const newPinned = !topic.isPinned;
    await Topic.findByIdAndUpdate(topic._id, { isPinned: newPinned });
    res.json({ isPinned: newPinned });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getTopics,
  createTopic,
  deleteTopic,
  likeTopic,
  getComments,
  createComment,
  deleteComment,
  pinTopic,
};
