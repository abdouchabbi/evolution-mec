// -----------------------------------------------------------------------------
// ملف مسارات الموظفين (routes/employee.routes.js) - محدث بالحماية
// -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const {
    getEmployees,
    createEmployee,
    registerFace,
    deleteEmployee,
} = require('../controllers/employee.controller');
const { protect } = require('../middleware/auth.middleware'); // <-- استيراد وسيط الحماية

// تطبيق الحماية على جميع المسارات في هذا الملف
// الآن، لا يمكن الوصول إلى أي من هذه المسارات إلا بعد تسجيل الدخول وإرسال مفتاح الوصول (Token)
router.route('/')
    .get(protect, getEmployees)
    .post(protect, createEmployee);

router.route('/:id')
    .delete(protect, deleteEmployee);

router.route('/:name/face')
    .post(protect, registerFace);

module.exports = router;
