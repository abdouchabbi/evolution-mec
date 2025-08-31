const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');
const generateToken = require('../utils/generateToken.js');

/**
 * @desc    تسجيل حساب مستخدم جديد (يمكن استخدامه من قبل مدير آخر)
 * @route   POST /api/users/register
 * @access  Private (Admin)
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
 * @desc    تسجيل دخول المستخدم
 * @route   POST /api/users/login
 * @access  Public
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
 * @desc    الحصول على جميع المستخدمين
 * @route   GET /api/users
 * @access  Private (Admin)
 */
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
});

/**
 * @desc    حذف مستخدم
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
const deleteUser = asyncHandler(async (req, res) => {
    // يمنع المدير من حذف نفسه
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

/**
 * @desc    تحديث ملف تعريف المستخدم (لتغيير كلمة المرور)
 * @route   PUT /api/users/profile
 * @access  Private
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
            token: generateToken(updatedUser._id), // إصدار مفتاح جديد
        });
    } else {
        res.status(404);
        throw new Error('المستخدم غير موجود');
    }
});


module.exports = { registerUser, loginUser, getUsers, deleteUser, updateUserProfile };

