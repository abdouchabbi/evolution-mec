const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({}).select('-faceDescriptor -pin'); // عدم إرسال البيانات الحساسة
    res.json(
        employees.map((emp) => ({
            _id: emp._id,
            name: emp.name,
            hasFaceDescriptor: !!emp.faceDescriptor && emp.faceDescriptor.length > 0,
        }))
    );
});

// @desc    Get all employees with face data for face login
// @route   GET /api/employees/face-login-data
// @access  Public
const getAllEmployeesForFaceLogin = asyncHandler(async (req, res) => {
    const employees = await Employee.find({ faceDescriptor: { $exists: true, $ne: [] } }).select('name faceDescriptor');
    res.json(employees);
});

// @desc    Verify employee PIN
// @route   POST /api/employees/verify-pin
// @access  Public
const verifyEmployeePin = asyncHandler(async (req, res) => {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) {
        res.status(400);
        throw new Error('بيانات التحقق ناقصة');
    }

    const employee = await Employee.findById(employeeId);

    if (employee && (await employee.matchPin(pin))) {
        res.json({
            _id: employee._id,
            name: employee.name,
        });
    } else {
        res.status(401);
        throw new Error('رمز PIN غير صحيح');
    }
});


// @desc    Create a new employee
// @route   POST /api/employees
// @access  Private
const createEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const employeeExists = await Employee.findOne({ name });

    if (employeeExists) {
        res.status(400);
        throw new Error('الموظف مسجل بالفعل');
    }

    const employee = await Employee.create({ name });
    res.status(201).json({
        _id: employee._id,
        name: employee.name,
        hasFaceDescriptor: false,
    });
});

// @desc    Register or update employee's face descriptor
// @route   POST /api/employees/face
// @access  Private
const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;

    // التحقق من تفرد بصمة الوجه
    const existingEmployees = await Employee.find({ faceDescriptor: { $exists: true, $ne: [] } });
    const faceMatcher = new faceapi.FaceMatcher(existingEmployees.map(e => new faceapi.LabeledFaceDescriptors(e.name, [new Float32Array(e.faceDescriptor)])));
    const bestMatch = faceMatcher.findBestMatch(new Float32Array(descriptor));

    if (bestMatch.label !== 'unknown') {
         res.status(400);
         throw new Error(`هذا الوجه مسجل بالفعل للموظف: ${bestMatch.label}`);
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }

    employee.faceDescriptor = descriptor;
    await employee.save();
    res.json({ message: 'تم تسجيل بصمة الوجه بنجاح' });
});

// @desc    Set employee PIN
// @route   PUT /api/employees/:id/set-pin
// @access  Private
const setEmployeePin = asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
        res.status(400);
        throw new Error('رمز PIN يجب أن يتكون من 4 أرقام');
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }

    employee.pin = pin;
    await employee.save();
    res.json({ message: 'تم تعيين رمز PIN بنجاح' });
});

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private
const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
        await Timesheet.deleteMany({ employeeName: employee.name });
        await employee.deleteOne();
        res.json({ message: 'تم حذف الموظف بنجاح' });
    } else {
        res.status(404);
        throw new Error('الموظف غير موجود');
    }
});

// @desc    Update employee (placeholder for future use)
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = asyncHandler(async (req, res) => {
    // This can be expanded later to update employee's name, etc.
    res.json({ message: 'Employee updated' });
});

module.exports = {
    getEmployees,
    getAllEmployeesForFaceLogin,
    verifyEmployeePin,
    createEmployee,
    registerFace,
    setEmployeePin,
    deleteEmployee,
    updateEmployee,
};

