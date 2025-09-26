// -----------------------------------------------------------------------------
// ملف إعدادات قاعدة البيانات (config/db.js)
// -----------------------------------------------------------------------------
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // تم حذف الخيارات الإضافية لأنها الآن افتراضية
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`تم الاتصال بقاعدة بيانات MongoDB بنجاح: ${conn.connection.host}`);
    } catch (error) {
        console.error(`خطأ في الاتصال بقاعدة البيانات: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;