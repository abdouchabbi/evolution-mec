// routes/user.routes.js
const express = require('express');
const router = express.Router();

// استيراد جميع الدوال من الكونترولر
const {
    registerUser,
    loginUser,
    getUsers,
    deleteUser,
    updateUserProfile,
    getUserProfile   // ✅ تأكد من إضافة هذه الدالة
} = require('../controllers/user.controller.js');

// استيراد Middleware الحماية
const { protect } = require('../middleware/auth.middleware.js');

// ==================== المسارات العامة (Public) ====================

// تسجيل الدخول
router.post('/login', loginUser);

// ==================== المسارات المحمية (Private - Admin Only) ====================

// تسجيل مستخدم جديد (Admin فقط)
router.route('/register').post(protect, registerUser);

// جلب جميع المستخدمين (Admin فقط)
router.route('/').get(protect, getUsers);

// حذف مستخدم (Admin فقط)
router.route('/:id').delete(protect, deleteUser);

// تحديث وقراءة بيانات الملف الشخصي للمستخدم
router.route('/profile')
    .get(protect, getUserProfile)       // قراءة بيانات الملف الشخصي
    .put(protect, updateUserProfile);   // تعديل بيانات الملف الشخصي

// تصدير الراوتر
module.exports = router;
