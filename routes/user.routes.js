const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
} = require('../controllers/user.controller.js');

// ======================================================
//                 *** المسارات العامة ***
//      (يمكن الوصول إليها بدون تسجيل دخول)
// ======================================================

// @route   POST /api/users/register
// @desc    تسجيل حساب مستخدم جديد (مدير)
router.post('/register', registerUser);

// @route   POST /api/users/login
// @desc    تسجيل دخول المستخدم والحصول على مفتاح وصول
router.post('/login', loginUser);

module.exports = router;

