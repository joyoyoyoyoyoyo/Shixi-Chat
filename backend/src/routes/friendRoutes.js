const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  searchUser, sendRequest, getRequests, respondRequest, getFriends, deleteFriend,
} = require('../controllers/friends/friendController');

router.get('/search', auth, searchUser);
router.post('/request', auth, sendRequest);
router.get('/requests', auth, getRequests);
router.post('/respond', auth, respondRequest);
router.get('/', auth, getFriends);
router.delete('/:friendId', auth, deleteFriend);

module.exports = router;
