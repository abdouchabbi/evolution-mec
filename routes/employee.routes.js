const express = require('express');
const router = express.Router();
const {
    getEmployees,
    getAllEmployeesForFaceLogin,
    verifyEmployeePin,
    createEmployee,
    updateEmployee,
    registerFace,
    deleteEmployee,
    setEmployeePin
} = require('../controllers/employee.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// ======================================================
//                 *** المسارات العامة ***
//     (يمكن الوصول إليها من تطبيق الموظف بدون تسجيل دخول)
// ======================================================

// مسار لجلب بيانات الوجوه لجميع الموظفين لشاشة الدخول
router.get('/face-login-data', getAllEmployeesForFaceLogin);

// مسار للتحقق من رمز PIN الخاص بالموظف
router.post('/verify-pin', verifyEmployeePin);


// ======================================================
//                *** المسارات المحمية ***
//      (لا يمكن الوصول إليها إلا من تطبيق المدير)
// ======================================================
router.route('/')
    .get(protect, getEmployees)
    .post(protect, createEmployee);

router.route('/face').post(protect, registerFace);

// مسار لتعيين أو تحديث رمز PIN للموظف
router.route('/:id/set-pin').put(protect, setEmployeePin);

router.route('/:id')
    .put(protect, updateEmployee)
    .delete(protect, deleteEmployee);

module.exports = router;

