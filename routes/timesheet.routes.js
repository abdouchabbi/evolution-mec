const express = require('express');
const router = express.Router();
const {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
} = require('../controllers/timesheet.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// -----------------------------------------------------------------------------
// تم الآن تأمين جميع المسارات المتعلقة بسجلات الدوام.
// لا يمكن لأي شخص التعامل مع هذه البيانات الحساسة إلا إذا كان مديرًا مصرحًا له.
// -----------------------------------------------------------------------------

router.route('/').get(protect, getTimesheets);
router.route('/entry').post(protect, createOrUpdateEntry);
router.route('/:id').put(protect, updateTimesheet);

module.exports = router;
