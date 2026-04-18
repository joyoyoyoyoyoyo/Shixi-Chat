const mongoose = require('mongoose');
const topicSchema = new mongoose.Schema({
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  images: [String],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Topic', topicSchema);
