const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/notifications/notificationController');

router.get('/', auth, ctrl.getNotifications);
router.get('/unread-count', auth, ctrl.getUnreadCount);
router.get('/management', auth, ctrl.getManagementRequests);
router.put('/read-all', auth, ctrl.markAllRead);
router.put('/:id/read', auth, ctrl.markRead);

module.exports = router;
