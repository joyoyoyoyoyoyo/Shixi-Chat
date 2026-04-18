const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/forums/forumController');

router.get('/', auth, ctrl.getForums);
router.post('/', auth, ctrl.createForum);
router.get('/:id', auth, ctrl.getForumDetail);
router.put('/:id', auth, ctrl.updateForum);
router.post('/:id/join', auth, ctrl.joinForum);
router.post('/:id/leave', auth, ctrl.leaveForum);
router.get('/:id/members', auth, ctrl.getMembers);
router.post('/:id/admins/:userId', auth, ctrl.setAdmin);
router.delete('/:id/admins/:userId', auth, ctrl.removeAdmin);
router.delete('/:id/members/:userId', auth, ctrl.removeMember);
router.get('/:id/requests', auth, ctrl.getJoinRequests);
router.post('/:id/requests/:reqId', auth, ctrl.respondJoinRequest);
router.delete('/:id', auth, ctrl.dissolveForum);

module.exports = router;
