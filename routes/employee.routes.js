// -----------------------------------------------------------------------------
// ملف مسارات الموظفين (routes/employee.routes.js) - محدث
// -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

// استيراد وحدة التحكم ككائن كامل لضمان استقرار الاستدعاءات
const employeeController = require('../controllers/employee.controller');

// المسار الرئيسي للموظفين: /api/employees
router.route('/')
    .get(employeeController.getEmployees)
    .post(employeeController.createEmployee);

// المسار الخاص بتسجيل بصمة الوجه: /api/employees/:name/face
router.route('/:name/face')
    .post(employeeController.registerFace);

// المسار الخاص بحذف الموظف باستخدام الـ ID
router.route('/:id')
    .delete(employeeController.deleteEmployee);

module.exports = router;
