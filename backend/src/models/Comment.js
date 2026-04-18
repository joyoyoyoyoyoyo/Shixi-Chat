const mongoose = require('mongoose');
const commentSchema = new mongoose.Schema({
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Comment', commentSchema);
