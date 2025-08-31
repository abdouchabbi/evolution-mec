const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const faceapi = require('face-api.js'); // <-- Fix: Import face-api.js

/**
 * دالة مساعدة لحساب إجمالي ساعات العمل من مصفوفة التسجيلات
 * @param {Array} entries - مصفوفة تسجيلات الدخول والخروج
 * @returns {number} - إجمالي الساعات
 */
const calculateTotalHours = (entries) => {
    let totalSeconds = 0;
    const sortedEntries = entries.sort((a, b) => a.time.localeCompare(b.time));
    
    for (let i = 0; i < sortedEntries.length; i += 2) {
        if (sortedEntries[i] && sortedEntries[i].type === 'check-in' && sortedEntries[i+1] && sortedEntries[i+1].type === 'check-out') {
            const checkInTime = new Date(`1970-01-01T${sortedEntries[i].time}:00`);
            const checkOutTime = new Date(`1970-01-01T${sortedEntries[i+1].time}:00`);
            if (checkOutTime > checkInTime) {
                totalSeconds += (checkOutTime - checkInTime) / 1000;
            }
        }
    }
    return totalSeconds / 3600; // تحويل الثواني إلى ساعات
};

// @desc    جلب سجلات الدوام لموظف معين خلال فترة زمنية
// @route   GET /api/timesheets
// @access  Public
const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate } = req.query;

    if (!employeeName || !startDate || !endDate) {
        res.status(400);
        throw new Error('معلومات الاستعلام ناقصة (اسم الموظف، تاريخ البداية، تاريخ النهاية)');
    }

    const records = await Timesheet.find({
        employeeName: employeeName.toUpperCase(),
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 'asc' });

    res.json(records);
});

// @desc    إنشاء أو تحديث حركة تسجيل (دخول/خروج)
// @route   POST /api/timesheets/entry
// @access  Public (Secured by Face Verification)
const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, project, description, faceDescriptor } = req.body;
    
    if (!employeeName || !date) {
        res.status(400);
        throw new Error('اسم الموظف والتاريخ مطلوبان');
    }

    // --- التحقق من الوجه (الخطوة الأهم) ---
    if (time) { // التحقق من الوجه مطلوب فقط عند تسجيل حركة دخول/خروج
        if (!faceDescriptor) {
            res.status(400);
            throw new Error('بصمة الوجه مطلوبة للتحقق.');
        }

        const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
        if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
            res.status(404);
            throw new Error('لم يتم العثور على بصمة وجه مسجلة لهذا الموظف.');
        }

        // مقارنة بصمات الوجوه
        const registeredDescriptor = new Float32Array(employee.faceDescriptor);
        const currentDescriptor = new Float32Array(faceDescriptor);
        const distance = faceapi.euclideanDistance(registeredDescriptor, currentDescriptor);
        
        // 0.6 is a common threshold for face recognition
        if (distance > 0.6) {
            res.status(401);
            throw new Error('الوجه غير مطابق. فشلت عملية التحقق.');
        }
    }

    let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });

    if (!timesheet) {
        // إنشاء سجل جديد إذا لم يكن موجودًا
        timesheet = new Timesheet({ employeeName: employeeName.toUpperCase(), date, project, description, entries: [] });
    } else {
        // تحديث المشروع والوصف إذا كانا موجودين في الطلب
        if(project) timesheet.project = project;
        if(description) timesheet.description = description;
    }
    
    // إضافة حركة دخول/خروج جديدة إذا كانت موجودة في الطلب
    if (time && location) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
        timesheet.entries.push({ type: newEntryType, time, location });
    }

    // إعادة حساب إجمالي الساعات
    timesheet.totalHours = calculateTotalHours(timesheet.entries);

    const updatedTimesheet = await timesheet.save();
    res.status(201).json(updatedTimesheet);
});


// @desc    تحديث سجل دوام (للمدير فقط)
// @route   PUT /api/timesheets/:id
// @access  Private
const updateTimesheet = asyncHandler(async (req, res) => {
    const timesheet = await Timesheet.findById(req.params.id);

    if (timesheet) {
        // يمكن للمدير تعديل أي بيانات هنا
        timesheet.project = req.body.project || timesheet.project;
        timesheet.description = req.body.description || timesheet.description;
        timesheet.entries = req.body.entries || timesheet.entries;
        
        // إعادة حساب إجمالي الساعات بعد التعديل
        timesheet.totalHours = calculateTotalHours(timesheet.entries);

        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else {
        res.status(404);
        throw new Error('لم يتم العثور على سجل الدوام');
    }
});


module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};

