const express = require('express');
const router = express.Router();
const {
    getClients,
    createClient,
    deleteClient,
} = require('../controllers/client.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// -----------------------------------------------------------------------------
// تم الآن تأمين جميع هذه المسارات. لا يمكن لأي شخص إضافة، عرض، أو حذف
// العملاء إلا إذا كان مديرًا وقام بتسجيل الدخول بنجاح.
// -----------------------------------------------------------------------------

router.route('/').get(protect, getClients).post(protect, createClient);
router.route('/:id').delete(protect, deleteClient);

module.exports = router;
