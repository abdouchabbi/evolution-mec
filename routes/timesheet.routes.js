const express = require('express');
const router = express.Router();
const {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
} = require('../controllers/timesheet.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// -----------------------------------------------------------------------------
// هذا الملف يحدد المسارات الخاصة بسجلات الدوام.
// بعض المسارات عامة ليستخدمها تطبيق الموظف، وبعضها محمي للمدير.
// -----------------------------------------------------------------------------

// مسار عام لجلب سجلات الدوام (يستخدمه كل من المدير والموظف)
// ومسار عام لتسجيل الحضور (يستخدمه الموظف ويتم التحقق منه على الخادم)
router.route('/').get(getTimesheets);
router.route('/entry').post(createOrUpdateEntry);

// مسار محمي للمدير فقط لتعديل سجل دوام معين يدويًا
router.route('/:id').put(protect, updateTimesheet);

module.exports = router;

