const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');
const generateToken = require('../utils/generateToken.js');

/**
 * تسجيل حساب مستخدم جديد
 * POST /api/users/register
 * Access: Private (Admin)
 */
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('الرجاء إدخال جميع الحقول');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('المستخدم مسجل بالفعل');
    }

    const user = await User.create({ name, email, password });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
        });
    } else {
        res.status(400);
        throw new Error('بيانات المستخدم غير صالحة');
    }
});

/**
 * تسجيل دخول المستخدم
 * POST /api/users/login
 * Access: Public
 */
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
});

/**
 * جلب بيانات ملف تعريف المستخدم
 * GET /api/users/profile
 * Access: Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
        });
    } else {
        res.status(404);
        throw new Error('المستخدم غير موجود');
    }
});

/**
 * تحديث بيانات المستخدم (ملف التعريف)
 * PUT /api/users/profile
 * Access: Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            token: generateToken(updatedUser._id),
        });
    } else {
        res.status(404);
        throw new Error('المستخدم غير موجود');
    }
});

/**
 * الحصول على جميع المستخدمين (للمدير)
 * GET /api/users
 * Access: Private (Admin)
 */
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
});

/**
 * حذف مستخدم (للمدير)
 * DELETE /api/users/:id
 * Access: Private (Admin)
 */
const deleteUser = asyncHandler(async (req, res) => {
    if (req.user._id.toString() === req.params.id) {
        res.status(400);
        throw new Error("لا يمكنك حذف حسابك الخاص.");
    }

    const user = await User.findById(req.params.id);
    if (user) {
        await user.deleteOne();
        res.json({ message: 'تم حذف المستخدم بنجاح' });
    } else {
        res.status(404);
        throw new Error('المستخدم غير موجود');
    }
});

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser
};
