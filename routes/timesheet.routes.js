const express = require('express');
const router = express.Router();
const {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
} = require('../controllers/timesheet.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// ======================================================
//                 *** المسارات العامة ***
//     (يمكن الوصول إليها من تطبيق الموظف بدون تسجيل دخول)
// ======================================================

// مسار لجلب سجلات الدوام لموظف معين
// ملاحظة: هذا المسار عام حاليًا، مما يعني أن أي شخص يمكنه رؤية سجلات أي موظف
// إذا كان يعرف اسمه. يمكن تأمينه لاحقًا بنظام مصادقة خاص بالموظفين.
router.route('/').get(getTimesheets);

// مسار لتسجيل حركة دخول أو خروج جديدة
// هذا المسار آمن لأن التحقق من الوجه يتم على الخادم
router.route('/entry').post(createOrUpdateEntry);


// ======================================================
//                *** المسارات المحمية ***
//      (لا يمكن الوصول إليها إلا من تطبيق المدير)
// ======================================================

// مسار للمدير لتحديث سجل دوام معين يدويًا
router.route('/:id').put(protect, updateTimesheet);

module.exports = router;

