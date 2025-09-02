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

// ======================================================
//                 *** المسارات العامة ***
//      (يمكن الوصول إليها بدون تسجيل دخول)
// ======================================================
router.post('/register', registerUser);
router.post('/login', loginUser);

// ======================================================
//           *** المسارات الخاصة بالمستخدم ***
//      (للمستخدم المسجل دخوله للتحكم بملفه الشخصي)
// ======================================================
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);

// ======================================================
//              *** المسارات الخاصة بالمدير ***
//        (للمدير للتحكم بجميع المستخدمين الآخرين)
// ======================================================
router.route('/')
    .get(protect, getUsers);

router.route('/:id')
    .delete(protect, deleteUser)
    .put(protect, updateUser);

module.exports = router;

