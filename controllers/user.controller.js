// -----------------------------------------------------------------------------
// ملف متحكم المستخدم (controllers/user.controller.js)
// -----------------------------------------------------------------------------
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

// دالة لإنشاء "مفتاح وصول" مؤقت
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // صلاحية المفتاح 30 يومًا
    });
};

/**
 * @desc    تسجيل حساب مدير جديد
 * @route   POST /api/users/register
 */
const registerUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'اسم المستخدم هذا مسجل بالفعل' });
        }
        const user = await User.create({ username, password });
        res.status(201).json({
            _id: user._id,
            username: user.username,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

/**
 * @desc    تسجيل دخول المدير
 * @route   POST /api/users/login
 */
const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

module.exports = { registerUser, loginUser };
