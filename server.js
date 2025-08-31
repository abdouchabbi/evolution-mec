const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const { loadModels } = require('./faceApi'); // استيراد خدمة تحميل النماذج

const employeeRoutes = require('./routes/employee.routes.js');
const clientRoutes = require('./routes/client.routes.js');
const projectRoutes = require('./routes/project.routes.js');
const timesheetRoutes = require('./routes/timesheet.routes.js');
const userRoutes = require('./routes/user.routes.js');
const { notFound, errorHandler } = require('./middleware/error.middleware.js');

// -----------------------------------------------------------------------------
// بدء تشغيل الخادم
// -----------------------------------------------------------------------------
async function startServer() {
    await loadModels(); // تحميل نماذج التعرف على الوجه
    connectDB(); // الاتصال بقاعدة البيانات

    const app = express();
    const PORT = process.env.PORT || 5000;

    // إعداد الوسطاء
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ✅ Health check
    app.all('/', (req, res) => {
        res.status(200).json({ status: 'ok', method: req.method });
    });

    app.all('/api', (req, res) => {
        res.status(200).json({ message: 'API is running...', method: req.method });
    });

    // ربط وحدات المسارات
    app.use('/api/employees', employeeRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/timesheets', timesheetRoutes);
    app.use('/api/users', userRoutes);

    // وسطاء معالجة الأخطاء
    app.use(notFound);
    app.use(errorHandler);

    // تشغيل الخادم
    app.listen(PORT, () => {
        console.log(`🚀 الخادم يعمل على المنفذ http://localhost:${PORT}`);
    });
}

startServer();
