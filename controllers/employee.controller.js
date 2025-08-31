const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');
const faceapi = require('face-api.js');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getEmployees = asyncHandler(async (req, res) => {
    // جلب جميع الموظفين
    const employees = await Employee.find({});
    
    // إرسال استجابة تحتوي على الحالة الصحيحة لبصمة الوجه
    res.json(
        employees.map((emp) => ({
            _id: emp._id,
            name: emp.name,
            hasFaceDescriptor: emp.hasFaceDescriptor, // استخدام الخاصية المحسوبة لضمان الدقة
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
            faceDescriptor: employee.faceDescriptor // إرسال البصمة لتطبيق الموظف
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
    const employeeExists = await Employee.findOne({ name: name.toUpperCase() });

    if (employeeExists) {
        res.status(400);
        throw new Error('الموظف مسجل بالفعل');
    }

    const employee = await Employee.create({ name: name.toUpperCase() });
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
    const existingEmployees = await Employee.find({ 
        faceDescriptor: { $exists: true, $ne: [] },
        _id: { $ne: employeeId } // استثناء الموظف الحالي من التحقق
    });

    if (existingEmployees.length > 0) {
        const labeledFaceDescriptors = existingEmployees.map(e => 
            new faceapi.LabeledFaceDescriptors(e.name, [new Float32Array(e.faceDescriptor)])
        );
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5);
        const bestMatch = faceMatcher.findBestMatch(new Float32Array(descriptor));

        if (bestMatch.label !== 'unknown') {
             res.status(400);
             throw new Error(`هذا الوجه مسجل بالفعل للموظف: ${bestMatch.label}`);
        }
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
        // حذف سجلات الدوام المرتبطة بالموظف
        await Timesheet.deleteMany({ employeeName: employee.name });
        // حذف الموظف نفسه
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
    // يمكن توسيع هذه الدالة لاحقًا لتحديث اسم الموظف، إلخ.
    res.json({ message: 'Employee updated' });
});

// @desc    Login employee (for older employee app versions)
// @route   POST /api/employees/login
// @access  Public
const loginEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error("اسم الموظف مطلوب");
    }
    
    const employee = await Employee.findOne({ name: name.toUpperCase() });

    if (employee) {
        res.json({
            _id: employee._id,
            name: employee.name,
            hasFaceDescriptor: employee.hasFaceDescriptor
        });
    } else {
        res.status(404);
        throw new Error("الموظف غير موجود");
    }
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
    loginEmployee,
};

