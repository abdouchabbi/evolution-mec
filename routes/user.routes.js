const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile } = require('../controllers/user.controller.js');

// تسجيل مستخدم جديد
router.post('/register', registerUser);

// تسجيل دخول
router.post('/login', loginUser);

// ملف تعريف المستخدم (Private - يحتاج وسيط حماية)
// router.get('/profile', protect, getUserProfile);

module.exports = router;
