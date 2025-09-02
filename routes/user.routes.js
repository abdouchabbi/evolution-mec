const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser,
    updateUser,
} = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// Routes for public access (registration and login)
router.post('/register', registerUser);
router.post('/login', loginUser);

// Routes for the logged-in user's own profile
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);

// Admin-only routes for managing all users
router.route('/')
    .get(protect, getUsers);

router.route('/:id')
    .delete(protect, deleteUser)
    .put(protect, updateUser);

module.exports = router;

