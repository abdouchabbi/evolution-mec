const express = require('express');
const router = express.Router();
const {
    getClients,
    createClient,
    deleteClient,
} = require('../controllers/client.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// -----------------------------------------------------------------------------
// تم الآن تأمين جميع المسارات المتعلقة بالعملاء.
// لا يمكن لأي شخص التعامل مع هذه البيانات إلا إذا كان مديرًا مصرحًا له.
// -----------------------------------------------------------------------------

router.route('/')
    .get(protect, getClients)
    .post(protect, createClient);

router.route('/:id')
    .delete(protect, deleteClient);

module.exports = router;

