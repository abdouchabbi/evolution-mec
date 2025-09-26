const express = require('express');
const router = express.Router();
const { getHolidays, createHoliday, deleteHoliday } = require('../controllers/holiday.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getHolidays).post(protect, createHoliday);
router.route('/:id').delete(protect, deleteHoliday);
module.exports = router;
