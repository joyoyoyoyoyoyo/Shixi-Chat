const mongoose = require('mongoose');
const forumSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  industry: { type: String, default: '其他' },
  tags: [String],
  image: { type: String, default: '' },
  color: { type: String, default: '#667eea' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Forum', forumSchema);
