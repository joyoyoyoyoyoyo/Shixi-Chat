const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const redis = require('../../../config/redis');
const { sendVerificationCode } = require('../../services/emailService');

const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateUserId = () =>
  Math.floor(10000000000 + Math.random() * 90000000000).toString();

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

const formatUser = (user) => ({
  id: user._id,
  userId: user.userId,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
});

// POST /api/auth/send-code
const sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: '邮箱不能为空' });

    const limitKey = `code_limit:${email}`;
    if (await redis.get(limitKey)) {
      return res.status(429).json({ message: '发送太频繁，请 60 秒后再试' });
    }

    const code = generateCode();
    await redis.setex(`verify_code:${email}`, 300, code);
    await redis.setex(limitKey, 60, '1');

    await sendVerificationCode(email, code);
    res.json({ message: '验证码已发送，请查收邮件' });
  } catch (err) {
    console.error('sendCode error:', err);
    res.status(500).json({ message: '发送失败，请稍后重试' });
  }
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, code } = req.body;

    if (!username || !email || !password || !code) {
      return res.status(400).json({ message: '请填写所有必填项' });
    }

    const savedCode = await redis.get(`verify_code:${email}`);
    if (!savedCode || savedCode !== code) {
      return res.status(400).json({ message: '验证码错误或已过期' });
    }

    // Only check email uniqueness (username can be duplicate)
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: '该邮箱已注册' });
    }

    const user = new User({ username, email, password });
    await user.save();
    await redis.del(`verify_code:${email}`);

    const token = signToken(user._id);
    res.status(201).json({
      message: '注册成功',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '请填写邮箱和密码' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: '邮箱或密码错误' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: '邮箱或密码错误' });

    // 老账号没有 userId（Mongoose default 只在内存生效，需检查 _doc 里的真实值）
    if (!user._doc.userId) {
      const newUserId = generateUserId();
      await User.updateOne(
        { _id: user._id, userId: { $exists: false } },
        { $set: { userId: newUserId } }
      );
      user.userId = newUserId;
    }

    const token = signToken(user._id);
    res.json({
      message: '登录成功',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: '用户不存在' });

    // 老账号没有 userId（Mongoose default 只在内存生效，需检查 _doc 里的真实值）
    if (!user._doc.userId) {
      const newUserId = generateUserId();
      await User.updateOne(
        { _id: user._id, userId: { $exists: false } },
        { $set: { userId: newUserId } }
      );
      user.userId = newUserId;
    }

    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: '获取用户信息失败' });
  }
};

module.exports = { sendCode, register, login, getMe };
