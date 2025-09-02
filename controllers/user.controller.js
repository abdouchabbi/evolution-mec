const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');
const generateToken = require('../utils/generateToken.js');

/**
 * @desc    تسجيل حساب مستخدم جديد (مدير)
 * @route   POST /api/users/register
 * @access  Public
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
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('بيانات المستخدم غير صالحة');
    }
});

/**
 * @desc    تسجيل دخول المستخدم والحصول على مفتاح وصول
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

module.exports = { registerUser, loginUser };

