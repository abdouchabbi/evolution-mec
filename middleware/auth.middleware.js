// -----------------------------------------------------------------------------
// ملف وسيط المصادقة (middleware/auth.middleware.js) - محدث
// -----------------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // احصل على المفتاح من الترويسة
            token = req.headers.authorization.split(' ')[1];

            // تحقق من صحة المفتاح
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // أرفق معلومات المستخدم بالطلب
            req.user = await User.findById(decoded.id).select('-password');
            
            next();
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح لك بالوصول، المفتاح غير صالح' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'غير مصرح لك بالوصول، لا يوجد مفتاح' });
    }
};

module.exports = { protect };

