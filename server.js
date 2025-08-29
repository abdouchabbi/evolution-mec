// -----------------------------------------------------------------------------
// الملف النهائي للخادم (server.js) - محدث بنظام المصادقة
// -----------------------------------------------------------------------------
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const { loadModels } = require('./faceApi'); // لاستيراد دالة تحميل النماذج

const connectDB = require('./config/db');
const employeeRoutes = require('./routes/employee.routes');
const clientRoutes = require('./routes/client.routes');
const projectRoutes = require('./routes/project.routes');
const timesheetRoutes = require('./routes/timesheet.routes');
const userRoutes = require('./routes/user.routes'); // <-- استيراد مسارات المستخدم الجديدة

// تحميل نماذج الذكاء الاصطناعي عند بدء تشغيل الخادم
loadModels();

// الاتصال بقاعدة البيانات
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// إعداد الوسيطات (Middleware)
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// تعريف واجهة برمجة التطبيقات (API Routes)
app.use('/api/employees', employeeRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/users', userRoutes); // <-- استخدام مسارات المستخدم الجديدة

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ http://localhost:${PORT}`);
});
