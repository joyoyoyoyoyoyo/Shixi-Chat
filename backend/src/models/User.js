const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 200 },
  industry: {
    type: String,
    enum: ['IT', '金融', '医疗', '教育', '制造', '零售', '其他'],
    default: '其他',
  },
  internship: {
    company: { type: String, default: '' },
    position: { type: String, default: '' },
  },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

// 保存前自动加密密码
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 验证密码方法
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
