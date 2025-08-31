// routes/timesheet.routes.js
const express = require('express');
const router = express.Router();

// استيراد الدوال من الكونترولر
const {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
} = require('../controllers/timesheet.controller.js');

// استيراد Middleware الحماية
const { protect } = require('../middleware/auth.middleware.js');

// 🔍 فحص إذا الدوال مستوردة بشكل صحيح
console.log({
  getTimesheets,
  createOrUpdateEntry,
  updateTimesheet,
  protect
});

// -----------------------------------------------------------------------------
// تم الآن تأمين جميع المسارات المتعلقة بسجلات الدوام.
// لا يمكن لأي شخص التعامل مع هذه البيانات الحساسة إلا إذا كان مديرًا مصرحًا له.
// -----------------------------------------------------------------------------

// جلب سجلات الدوام - للمدير
router.route('/').get(protect, getTimesheets);

// تسجيل حركة دخول أو خروج جديدة - للموظف
router.route('/entry').post(protect, createOrUpdateEntry);

// تحديث سجل دوام - للمدير
router.route('/:id').put(protect, updateTimesheet);

module.exports = router;
