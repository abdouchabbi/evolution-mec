// -----------------------------------------------------------------------------
// ملف مسارات سجلات الدوام (routes/timesheet.routes.js) - محدث
// -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { getTimesheets, recordEntry, updateTimesheet } = require('../controllers/timesheet.controller');

// جلب سجلات الدوام (للبحث والتقارير)
router.get('/', getTimesheets);

// تسجيل حركة دخول أو خروج جديدة (للموظف)
router.post('/entry', recordEntry);

// تحديث سجل دوام موجود (للمدير)
router.put('/:id', updateTimesheet);


module.exports = router;
