const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

// تسجيل مستخدم جديد
router.post('/register', registerUser);

// تسجيل الدخول
router.post('/login', loginUser);

// جلب ملف التعريف (محمي)
router.get('/profile', protect, getUserProfile);

// تحديث ملف التعريف (محمي)
router.put('/profile', protect, updateUserProfile);

// الحصول على جميع المستخدمين (محمي للمدير)
router.get('/', protect, getUsers);

// حذف مستخدم (محمي للمدير)
router.delete('/:id', protect, deleteUser);

module.exports = router;
