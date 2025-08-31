const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUsers,
    deleteUser,
    updateUserProfile
} = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// === المسارات العامة (Public) ===
router.post('/login', loginUser);

// === المسارات المحمية (Private - Admin Only) ===
// هذه المسارات لا يمكن الوصول إليها إلا من قبل مدير مسجل دخوله
router.route('/register').post(protect, registerUser);
router.route('/').get(protect, getUsers);
router.route('/:id').delete(protect, deleteUser);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile); // تم إضافة GET هنا

module.exports = router;

