const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  type: { type: String, enum: ['text', 'system'], default: 'text' },
  mentionedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isRecalled: { type: Boolean, default: false },
  recalledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('GroupMessage', schema);
