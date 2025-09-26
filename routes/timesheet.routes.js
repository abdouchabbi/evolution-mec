const express = require('express');
const router = express.Router();
const { getTimesheets, createOrUpdateEntry, updateTimesheet } = require('../controllers/timesheet.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getTimesheets);
router.route('/entry').post(createOrUpdateEntry);
router.route('/:id').put(protect, updateTimesheet);
module.exports = router;
