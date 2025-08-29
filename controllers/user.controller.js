const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');
const generateToken = require('../utils/generateToken.js');

/**
 * @desc    تسجيل حساب مدير جديد
 * @route   POST /api/users/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // التحقق من أن جميع الحقول موجودة
    if (!name || !email || !password) {
        res.status(400); // Bad Request
        throw new Error('الرجاء إدخال جميع الحقول');
    }

    // التحقق مما إذا كان المستخدم مسجلاً بالفعل
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('المستخدم مسجل بالفعل');
    }

    // إنشاء مستخدم جديد (سيتم تشفير كلمة المرور تلقائيًا بواسطة Mongoose pre-save hook)
    const user = await User.create({
        name,
        email,
        password,
    });

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
 * @desc    مصادقة المستخدم والحصول على مفتاح الدخول (تسجيل الدخول)
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // التحقق من وجود المستخدم ومطابقة كلمة المرور المشفرة
    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401); // Unauthorized
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
});

/**
 * @desc    الحصول على ملف تعريف المستخدم
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
    // يتم تعيين req.user بواسطة وسيط الحماية (protect middleware)
    res.json({
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
    });
});


module.exports = { registerUser, loginUser, getUserProfile };

