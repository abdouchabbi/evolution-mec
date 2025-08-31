const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');
const mongoose = require('mongoose');
const faceapi = require('../faceApi.js'); // استيراد خدمة الوجه

// @desc    Get all employees for admin view
// @route   GET /api/employees
// @access  Private
const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({}).select('-faceDescriptor -pin');
    res.json(employees);
});

// @desc    Get all employees' face data for employee login screen
// @route   GET /api/employees/face-login-data
// @access  Public
const getAllEmployeesForFaceLogin = asyncHandler(async (req, res) => {
    const employees = await Employee.find({ faceDescriptor: { $exists: true, $ne: [] } }).select('name faceDescriptor');
    res.json(employees);
});

// @desc    Verify employee PIN after face recognition
// @route   POST /api/employees/verify-pin
// @access  Public
const verifyEmployeePin = asyncHandler(async (req, res) => {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) {
        res.status(400);
        throw new Error('Employee ID and PIN are required.');
    }

    const employee = await Employee.findById(employeeId);
    if (employee && (await employee.matchPin(pin))) {
        res.json({
            _id: employee._id,
            name: employee.name,
            faceDescriptor: employee.faceDescriptor,
        });
    } else {
        res.status(401);
        throw new Error('رمز PIN غير صحيح.');
    }
});


// @desc    Create a new employee
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

// @desc    Update an employee (name or PIN)
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        if(req.body.name) {
            employee.name = req.body.name.toUpperCase();
        }
        if(req.body.pin) {
             employee.pin = req.body.pin;
        }
        const updatedEmployee = await employee.save();
        res.json(updatedEmployee);
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});


// @desc    Register or update employee face descriptor
// @route   POST /api/employees/face
// @access  Private
const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;
    if (!employeeId || !descriptor) {
        res.status(400);
        throw new Error("Employee ID and face descriptor are required.");
    }

    // Check if this face is already registered for another employee
    const employees = await Employee.find({ _id: { $ne: employeeId }, faceDescriptor: { $exists: true, $ne: [] } });
    if(employees.length > 0) {
        const labeledFaceDescriptors = employees.map(
            e => new faceapi.faceapi.LabeledFaceDescriptors(e.name, [new Float32Array(e.faceDescriptor)])
        );
        const faceMatcher = new faceapi.faceapi.FaceMatcher(labeledFaceDescriptors);
        const bestMatch = faceMatcher.findBestMatch(new Float32Array(descriptor));
        
        if (bestMatch.label !== 'unknown') {
            res.status(400);
            throw new Error(`هذا الوجه مسجل بالفعل للموظف: ${bestMatch.label}`);
        }
    }
    
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

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private
const deleteEmployee = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('المعرّف غير صالح');
    }
    const employee = await Employee.findById(req.params.id);
    if (employee) {
        // Also delete their timesheets
        await Timesheet.deleteMany({ employeeName: employee.name });
        await employee.deleteOne();
        res.json({ message: 'تم حذف الموظف بنجاح' });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});

module.exports = {
    getEmployees,
    getAllEmployeesForFaceLogin,
    verifyEmployeePin,
    createEmployee,
    updateEmployee,
    registerFace,
    deleteEmployee
};

