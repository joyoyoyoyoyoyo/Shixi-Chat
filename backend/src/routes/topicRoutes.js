const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/topics');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const ctrl = require('../controllers/topics/topicController');

router.get('/', auth, ctrl.getTopics);
router.post('/', auth, upload.array('images', 9), ctrl.createTopic);
router.delete('/:id', auth, ctrl.deleteTopic);
router.post('/:id/like', auth, ctrl.likeTopic);
router.get('/:id/comments', auth, ctrl.getComments);
router.post('/:id/comments', auth, ctrl.createComment);
router.delete('/:id/comments/:commentId', auth, ctrl.deleteComment);
router.post('/:id/pin', auth, ctrl.pinTopic);

module.exports = router;
