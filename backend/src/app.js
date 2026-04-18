require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('../config/db');

const app = express();

connectDB();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/friends', require('./routes/friendRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/forums', require('./routes/forumRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
