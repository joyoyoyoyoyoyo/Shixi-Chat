const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/groups/groupController');

router.get('/', auth, ctrl.getGroups);
router.post('/', auth, ctrl.createGroup);
router.get('/:id/messages', auth, ctrl.getGroupMessages);
router.put('/:id', auth, ctrl.updateGroup);
router.put('/:id/announcement', auth, ctrl.setGroupAnnouncement);
router.put('/:id/mute', auth, ctrl.setMuted);
router.post('/:id/invite', auth, ctrl.inviteMembers);
router.post('/:id/leave', auth, ctrl.leaveGroup);
router.delete('/:id/members/:userId', auth, ctrl.kickMember);
router.delete('/:id', auth, ctrl.dissolveGroup);

module.exports = router;
