const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const redis = require('../../../config/redis');
const { sendVerificationCode } = require('../../services/emailService');

const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/send-code
const sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: '邮箱不能为空' });

    // 60 秒内只能发一次
    const limitKey = `code_limit:${email}`;
    if (await redis.get(limitKey)) {
      return res.status(429).json({ message: '发送太频繁，请 60 秒后再试' });
    }

    const code = generateCode();
    await redis.setex(`verify_code:${email}`, 300, code); // 5 分钟有效
    await redis.setex(limitKey, 60, '1');                  // 60 秒冷却

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

    // 校验验证码
    const savedCode = await redis.get(`verify_code:${email}`);
    if (!savedCode || savedCode !== code) {
      return res.status(400).json({ message: '验证码错误或已过期' });
    }

    // 检查重复
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email)
        return res.status(400).json({ message: '该邮箱已注册' });
      return res.status(400).json({ message: '用户名已被占用' });
    }

    const user = new User({ username, email, password });
    await user.save();
    await redis.del(`verify_code:${email}`);

    const token = signToken(user._id);
    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar },
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
      return res.status(400).json({ message: '请输入邮箱和密码' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: '账号不存在' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: '密码错误' });

    const token = signToken(user._id);
    res.json({
      message: '登录成功',
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
};

// GET /api/auth/me  (需要登录)
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: '获取用户信息失败' });
  }
};

module.exports = { sendCode, register, login, getMe };
