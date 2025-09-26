const express = require('express');
const router = express.Router();
const { getLeaveForEmployee, createLeave, deleteLeave } = require('../controllers/leave.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getLeaveForEmployee).post(protect, createLeave);
router.route('/:id').delete(protect, deleteLeave);
module.exports = router;
