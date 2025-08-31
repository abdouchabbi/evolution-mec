// -----------------------------------------------------------------------------
// middleware/error.middleware.js
// -----------------------------------------------------------------------------

// وسيط لمعالجة الأخطاء
const errorHandler = (err, req, res, next) => {
    // إذا السيرفر أرسل statusCode قبل الخطأ، استعمله، وإلا 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: err.message || "حدث خطأ غير متوقع",
        // إظهار stack فقط في وضع التطوير (لتسهيل التصحيح)
        stack: process.env.NODE_ENV === "production" ? null : err.stack
    });
};

// وسيط للـ 404 (لم يتم العثور على المسار)
const notFound = (req, res, next) => {
    const error = new Error(`لم يتم العثور على المسار: ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = {
    errorHandler,
    notFound
};
