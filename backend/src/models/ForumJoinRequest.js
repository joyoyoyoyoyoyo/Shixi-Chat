const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
schema.index({ forum: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('ForumJoinRequest', schema);
