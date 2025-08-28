// -----------------------------------------------------------------------------
// الملف النهائي للخادم (server.js) - نسخة مطورة
// -----------------------------------------------------------------------------
// يقوم بتحميل نماذج التعرف على الوجه عند بدء التشغيل ليكون جاهزًا للمعالجة.
// -----------------------------------------------------------------------------

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const faceapi = require('face-api.js');
const { canvas, Canvas, Image, ImageData } = require('canvas');

// تهيئة face-api.js للعمل في بيئة Node.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const connectDB = require('./config/db');
const employeeRoutes = require('./routes/employee.routes');
const clientRoutes = require('./routes/client.routes');
const projectRoutes = require('./routes/project.routes');
const timesheetRoutes = require('./routes/timesheet.routes');

dotenv.config();

// --- تحميل نماذج التعرف على الوجه ---
async function loadModels() {
    console.log("جاري تحميل نماذج التعرف على الوجه...");
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, 'models', 'face-api-models')),
        faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'models', 'face-api-models')),
        faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'models', 'face-api-models'))
    ]);
    console.log("تم تحميل النماذج بنجاح.");
}

// --- بدء تشغيل التطبيق ---
async function startServer() {
    await loadModels(); // انتظار تحميل النماذج أولاً
    connectDB(); // ثم الاتصال بقاعدة البيانات

    const app = express();
    const PORT = process.env.PORT || 5000;

    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    app.use('/api/employees', employeeRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/timesheets', timesheetRoutes);

    app.listen(PORT, () => {
        console.log(`الخادم يعمل على المنفذ http://localhost:${PORT}`);
    });
}

startServer();
