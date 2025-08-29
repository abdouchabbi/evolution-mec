const jwt = require('jsonwebtoken');

/**
 * يقوم بإنشاء مفتاح وصول (JWT Token) آمن وموقع.
 * @param {string} id - المعرف الفريد للمستخدم.
 * @returns {string} - مفتاح الوصول (Token).
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // صلاحية المفتاح 30 يومًا
    });
};

module.exports = generateToken;
