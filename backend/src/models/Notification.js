const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['like', 'comment'], required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum' },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  topicTitle: { type: String, default: '' },
  commentContent: { type: String, default: '' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Notification', schema);
