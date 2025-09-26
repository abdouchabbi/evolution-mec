const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile, getUsers, deleteUser, updateUser } = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.route('/').get(protect, getUsers);
router.route('/:id').delete(protect, deleteUser).put(protect, updateUser);
module.exports = router;
