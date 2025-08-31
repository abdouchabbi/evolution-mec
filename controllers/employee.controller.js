const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');

// @desc    تسجيل موظف جديد
// @route   POST /api/employees
// @access  Private (Admin)
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

// @desc    تسجيل دخول الموظف والتحقق من وجوده
// @route   POST /api/employees/login
// @access  Public
const loginEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('اسم الموظف مطلوب');
    }

    // البحث عن الموظف (غير حساس لحالة الأحرف)
    const employee = await Employee.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

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


// @desc    جلب جميع الموظفين (للمدير)
// @route   GET /api/employees
// @access  Private (Admin)
const getEmployees = asyncHandler(async (req, res) => {
    // Check if a specific employee is requested by name (for employee app login)
    if (req.query.name) {
        const employee = await Employee.findOne({ name: req.query.name.toUpperCase() });
        if (employee) {
            res.json([employee]); // Return as an array to match frontend expectation
        } else {
            res.json([]);
        }
    } else {
        // Otherwise, return all employees for the admin panel
        const employees = await Employee.find({});
        res.json(employees);
    }
});

// @desc    تسجيل بصمة الوجه لموظف
// @route   POST /api/employees/face
// @access  Private (Admin)
const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        res.status(400);
        throw new Error('معرف الموظف غير صالح');
    }
    
    // التحقق من أن هذه البصمة غير مسجلة لموظف آخر
    const existingEmployeeWithFace = await Employee.findOne({ faceDescriptor: descriptor });
    if (existingEmployeeWithFace && existingEmployeeWithFace._id.toString() !== employeeId) {
        res.status(400);
        throw new Error('هذا الوجه مسجل بالفعل لموظف آخر.');
    }

    const employee = await Employee.findById(employeeId);

    if (employee) {
        employee.faceDescriptor = descriptor;
        employee.hasFaceDescriptor = true;
        await employee.save();
        res.json({ message: 'تم تسجيل بصمة الوجه بنجاح' });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});

// @desc    حذف موظف
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
const deleteEmployee = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('معرف الموظف غير صالح');
    }

    const employee = await Employee.findById(req.params.id);

    if (employee) {
        // حذف جميع سجلات الدوام المرتبطة به أيضًا
        await Timesheet.deleteMany({ employeeName: employee.name });
        await employee.deleteOne();
        res.json({ message: 'تم حذف الموظف وجميع سجلاته بنجاح' });
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
    deleteEmployee,
};
