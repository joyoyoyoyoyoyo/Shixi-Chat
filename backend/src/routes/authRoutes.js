const express = require('express');
const router = express.Router();
const { sendCode, register, login, getMe } = require('../controllers/auth/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/send-code', sendCode);
router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);

module.exports = router;
