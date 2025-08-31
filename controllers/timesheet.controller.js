const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const { faceApiForNode, canvas } = require('../faceApi');

/**
 * دالة مساعدة لحساب إجمالي ساعات العمل.
 * @param {Array} entries - مصفوفة تسجيلات الدخول والخروج.
 * @returns {number} - إجمالي ساعات العمل بالثواني.
 */
function calculateTotalHours(entries) {
    let totalSeconds = 0;
    const sortedEntries = entries
        .map(e => ({ ...e, timeInSeconds: parseInt(e.time.split(':')[0]) * 3600 + parseInt(e.time.split(':')[1]) * 60 }))
        .sort((a, b) => a.timeInSeconds - b.timeInSeconds);

    for (let i = 0; i < sortedEntries.length; i += 2) {
        if (sortedEntries[i] && sortedEntries[i+1] && sortedEntries[i].type === 'check-in' && sortedEntries[i+1].type === 'check-out') {
            totalSeconds += sortedEntries[i+1].timeInSeconds - sortedEntries[i].timeInSeconds;
        }
    }
    return totalSeconds / 3600; // إرجاع الساعات
}


/**
 * @desc    جلب سجلات الدوام لموظف معين خلال فترة زمنية.
 * @route   GET /api/timesheets
 * @access  Private
 */
const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate } = req.query;
    if (!employeeName || !startDate || !endDate) {
        res.status(400);
        throw new Error('معلومات الاستعلام ناقصة');
    }

    const records = await Timesheet.find({
        employeeName: employeeName.toUpperCase(),
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 'asc' });

    res.json(records);
});

/**
 * @desc    تسجيل حركة دخول أو خروج جديدة (مع التحقق من الوجه).
 * @route   POST /api/timesheets/entry
 * @access  Public (Employee)
 */
const recordEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, faceDescriptor } = req.body;
    
    if (!employeeName || !date || !time || !location) {
        res.status(400);
        throw new Error('بيانات التسجيل ناقصة');
    }

    if (!faceDescriptor) {
        res.status(400);
        throw new Error('بصمة الوجه مطلوبة للتحقق.');
    }

    // 1. جلب بصمة الوجه المسجلة للموظف
    const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        res.status(404);
        throw new Error('لم يتم تسجيل بصمة الوجه لهذا الموظف.');
    }

    // 2. مقارنة بصمات الوجوه
    const registeredDescriptor = new Float32Array(employee.faceDescriptor);
    const newDescriptor = new Float32Array(faceDescriptor);
    const distance = faceapi.euclideanDistance(registeredDescriptor, newDescriptor);
    
    // 0.6 is a common threshold for face recognition
    if (distance > 0.6) {
        res.status(401);
        throw new Error('الوجه غير مطابق، فشل التحقق.');
    }

    // 3. تحديث سجل الدوام
    const timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });

    if (timesheet) {
        // تحديد نوع الحركة (دخول أو خروج)
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = (!lastEntry || lastEntry.type === 'check-out') ? 'check-in' : 'check-out';
        
        timesheet.entries.push({ type: newEntryType, time, location });
        timesheet.totalHours = calculateTotalHours(timesheet.entries);
        await timesheet.save();
        res.status(200).json(timesheet);
    } else {
        // إنشاء سجل جديد لهذا اليوم
        const newTimesheet = await Timesheet.create({
            employeeName: employeeName.toUpperCase(),
            date,
            entries: [{ type: 'check-in', time, location }],
            totalHours: 0
        });
        res.status(201).json(newTimesheet);
    }
});


/**
 * @desc    تحديث سجل دوام (للمدير)
 * @route   PUT /api/timesheets/:id
 * @access  Private
 */
const updateTimesheet = asyncHandler(async (req, res) => {
    const timesheet = await Timesheet.findById(req.params.id);

    if (timesheet) {
        timesheet.project = req.body.project || timesheet.project;
        timesheet.description = req.body.description || timesheet.description;
        timesheet.entries = req.body.entries || timesheet.entries;
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
    recordEntry,
    updateTimesheet
};
