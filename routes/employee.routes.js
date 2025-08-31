const express = require('express');
const router = express.Router();
const {
    createEmployee,
    loginEmployee,
    getEmployees,
    registerFace,
    deleteEmployee
} = require('../controllers/employee.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// === المسارات العامة (Public) ===
// مسار جديد ومخصص لتسجيل دخول الموظف
router.post('/login', loginEmployee);

// === المسارات المحمية (Private - Admin Only) ===
// هذه المسارات لا يمكن الوصول إليها إلا من قبل مدير مسجل دخوله
router.route('/')
    .post(protect, createEmployee)
    .get(protect, getEmployees);

router.route('/:id')
    .delete(protect, deleteEmployee);
    
router.post('/face', protect, registerFace);


module.exports = router;
