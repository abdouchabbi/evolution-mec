const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');

// --- 1. إضافة المكتبات الجديدة في الأعلى ---
const faceapi = require('face-api.js');
const canvas = require('canvas');
const tf = require('@tensorflow/tfjs-node');

// --- 2. تهيئة بيئة التعرف على الوجه ---
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// تأكد من تحميل الموديلات مرة واحدة عند بدء تشغيل السيرفر
// (ضع هذا الجزء خارج الدوال)
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk('./models'),
    faceapi.nets.faceLandmark68Net.loadFromDisk('./models'),
    faceapi.nets.faceRecognitionNet.loadFromDisk('./models')
]).then(() => console.log('FaceAPI models loaded successfully on server.'));


const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({ kioskId: req.kioskId });
    const employeesWithStatus = employees.map((emp) => ({
        _id: emp._id,
        name: emp.name,
        hasFaceDescriptor: emp.faceDescriptor && emp.faceDescriptor.length > 0
    }));
    res.json(employeesWithStatus);
});

const createEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const employeeExists = await Employee.findOne({ name: name.toUpperCase(), kioskId: req.kioskId });
    if (employeeExists) {
        res.status(400);
        throw new Error('Employee already exists in this kiosk');
    }
    const employee = await Employee.create({ name: name.toUpperCase(), kioskId: req.kioskId });
    res.status(201).json({ _id: employee._id, name: employee.name, hasFaceDescriptor: false });
});


// --- 3. تعديل دالة registerFace بالكامل ---
const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;
    const kioskId = req.kioskId; // الحصول على kioskId من المستخدم المصادق عليه

    if (!descriptor || descriptor.length === 0) {
        res.status(400);
        throw new Error('Face descriptor is missing.');
    }

    // الخطوة 1: البحث عن كل الموظفين الآخرين في نفس الشركة الذين لديهم بصمة وجه مسجلة
    const otherEmployeesWithFace = await Employee.find({
        kioskId: kioskId,
        _id: { $ne: employeeId }, // استثناء الموظف الحالي
        faceDescriptor: { $exists: true, $ne: [] }
    });

    // الخطوة 2: التحقق مما إذا كان الوجه الجديد يطابق أي وجه موجود
    if (otherEmployeesWithFace.length > 0) {
        const labeledFaceDescriptors = otherEmployeesWithFace.map(
            emp => new faceapi.LabeledFaceDescriptors(emp.name, [new Float32Array(emp.faceDescriptor)])
        );

        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5); // 0.5 = 50%
        const bestMatch = faceMatcher.findBestMatch(new Float32Array(descriptor));

        if (bestMatch.label !== 'unknown') {
            res.status(400);
            throw new Error(`هذا الشخص مسجل بالفعل تحت اسم: ${bestMatch.label}`);
        }
    }

    // الخطوة 3: إذا لم يتم العثور على تطابق، قم بحفظ بصمة الوجه الجديدة
    const employee = await Employee.findOne({ _id: employeeId, kioskId: kioskId });
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found in your kiosk');
    }

    employee.faceDescriptor = descriptor;
    await employee.save();
    res.json({ message: 'Impronta facciale registrata con successo!' });
});


const setEmployeePin = asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
        res.status(400);
        throw new Error('PIN must be 4 digits');
    }
    const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found in your kiosk');
    }
    employee.pin = pin;
    await employee.save();
    res.json({ message: 'PIN set successfully' });
});

const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (employee) {
        await Timesheet.deleteMany({ employeeName: employee.name, kioskId: req.kioskId });
        await employee.deleteOne();
        res.json({ message: 'Employee deleted successfully' });
    } else {
        res.status(404);
        throw new Error('Employee not found in your kiosk');
    }
});

const getAllEmployeesForFaceLogin = asyncHandler(async (req, res) => {
    const { kioskId } = req.params;
    if (!kioskId) {
        res.status(400);
        throw new Error('Kiosk ID is required');
    }
    const employees = await Employee.find({
        kioskId: kioskId,
        faceDescriptor: { $exists: true, $ne: [] }
    }).select('name faceDescriptor');
    res.json(employees);
});

const verifyEmployeePin = asyncHandler(async (req, res) => {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) {
        res.status(400);
        throw new Error('Verification data is missing');
    }
    const employee = await Employee.findById(employeeId);
    if (employee && (await employee.matchPin(pin))) {
        res.json({ _id: employee._id, name: employee.name, kioskId: employee.kioskId });
    } else {
        res.status(401);
        throw new Error('Incorrect PIN');
    }
});


module.exports = {
    getEmployees,
    createEmployee,
    registerFace,
    setEmployeePin,
    deleteEmployee,
    getAllEmployeesForFaceLogin,
    verifyEmployeePin
};