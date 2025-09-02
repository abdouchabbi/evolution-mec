const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const { loadModels } = require('./faceApi'); 

// استيراد جميع وحدات المسارات
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
    // تحميل نماذج التعرف على الوجه أولاً
    await loadModels();

    // الاتصال بقاعدة البيانات
    connectDB();

    const app = express();
    const PORT = process.env.PORT || 5000;

    // إعداد الوسيطات (Middleware)
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // تعريف المسار الرئيسي للخادم
    app.get('/', (req, res) => {
        res.send('Evolution MEC API is running successfully.');
    });
    
    // ربط وحدات المسارات (API Routes)
    app.use('/api/employees', employeeRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/timesheets', timesheetRoutes);
    app.use('/api/users', userRoutes); // <-- تم ربط مسارات المستخدمين

    // وسيطات معالجة الأخطاء (يجب أن تكون في النهاية)
    app.use(notFound);
    app.use(errorHandler);

    // تشغيل الخادم
    app.listen(PORT, () => {
        console.log(`الخادم يعمل على المنفذ http://localhost:${PORT}`);
    });
}

startServer();

