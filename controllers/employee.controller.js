const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');
const { faceApiForNode } = require('../faceApi');

// @desc    إنشاء موظف جديد
// @route   POST /api/employees
// @access  Private
const createEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const employeeExists = await Employee.findOne({ name: name.toUpperCase() });

    if (employeeExists) {
        res.status(400);
        throw new Error('الموظف مسجل بالفعل');
    }

    const employee = await Employee.create({ name: name.toUpperCase() });
    res.status(201).json(employee);
});

// @desc    تسجيل دخول الموظف وجلب بياناته
// @route   POST /api/employees/login
// @access  Public
const loginEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('اسم الموظف مطلوب');
    }

    const employee = await Employee.findOne({ name: name.toUpperCase() });

    if (employee) {
        res.json({
            _id: employee._id,
            name: employee.name,
            hasFaceDescriptor: !!employee.faceDescriptor && employee.faceDescriptor.length > 0,
            faceDescriptor: employee.faceDescriptor
        });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});


// @desc    جلب كل الموظفين
// @route   GET /api/employees
// @access  Private
const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({});
    res.json(employees.map(e => ({
        _id: e._id,
        name: e.name,
        hasFaceDescriptor: !!e.faceDescriptor && e.faceDescriptor.length > 0
    })));
});


// @desc    تسجيل بصمة الوجه لموظف
// @route   POST /api/employees/face
// @access  Private
const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;

    // 1. التحقق من تفرد بصمة الوجه
    const employees = await Employee.find({});
    for (const emp of employees) {
        if (emp.faceDescriptor && emp.faceDescriptor.length > 0 && emp._id.toString() !== employeeId) {
            const distance = faceApiForNode.euclideanDistance(new Float32Array(descriptor), new Float32Array(emp.faceDescriptor));
            if (distance < 0.6) { // 0.6 is a common threshold
                res.status(400);
                throw new Error(`هذا الوجه مسجل بالفعل للموظف: ${emp.name}`);
            }
        }
    }
    
    // 2. تحديث بصمة الوجه
    const employee = await Employee.findById(employeeId);
    if (employee) {
        employee.faceDescriptor = descriptor;
        await employee.save();
        res.json({ message: 'تم تسجيل بصمة الوجه بنجاح' });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});


// @desc    حذف موظف
// @route   DELETE /api/employees/:id
// @access  Private
const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);
    if (employee) {
        await employee.deleteOne();
        // اختياري: حذف سجلات الدوام المرتبطة به
        await Timesheet.deleteMany({ employeeName: employee.name });
        res.json({ message: 'تم حذف الموظف بنجاح' });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});


module.exports = {
    createEmployee,
    loginEmployee,
    getEmployees,
    registerFace,
    deleteEmployee
};

