const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');

/**
 * وسيط حماية يتحقق من وجود مفتاح دخول (Token) صالح.
 * إذا كان المفتاح صالحًا، يتم إرفاق بيانات المستخدم بالطلب.
 * إذا لم يكن كذلك، يتم رفض الوصول.
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // التحقق من وجود الترويسة وبدءها بـ Bearer
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // استخراج المفتاح من الترويسة
            token = req.headers.authorization.split(' ')[1];

            // التحقق من صحة المفتاح وتوقيعه
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // جلب بيانات المستخدم من قاعدة البيانات وإرفاقها بالطلب
            // نستثني كلمة المرور من البيانات التي يتم إرفاقها
            req.user = await User.findById(decoded.id).select('-password');

            next(); // الانتقال إلى الخطوة التالية (الدالة المطلوبة)
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('غير مصرح لك بالوصول، المفتاح غير صالح');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('غير مصرح لك بالوصول، لا يوجد مفتاح');
    }
});

module.exports = { protect };

