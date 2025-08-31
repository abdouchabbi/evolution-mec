const asyncHandler = require('express-async-handler');
const faceapi = require('face-api.js');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');

/**
 * دالة مساعدة لحساب إجمالي الساعات بين أربع نقاط زمنية.
 * @param {Array} entries - مصفوفة تحتوي على تسجيلات الدخول والخروج.
 * @returns {number} - إجمالي الساعات.
 */
const calculateTotalHours = (entries) => {
    let totalSeconds = 0;
    const sortedEntries = entries.sort((a, b) => a.time.localeCompare(b.time));

    for (let i = 0; i < sortedEntries.length; i += 2) {
        const checkIn = sortedEntries[i];
        const checkOut = sortedEntries[i + 1];

        if (checkIn && checkOut && checkIn.type === 'check-in' && checkOut.type === 'check-out') {
            const checkInTime = new Date(`1970-01-01T${checkIn.time}:00`);
            const checkOutTime = new Date(`1970-01-01T${checkOut.time}:00`);
            // Handles overnight shifts by checking if checkout is on the next day
            if (checkOutTime < checkInTime) {
                checkOutTime.setDate(checkOutTime.getDate() + 1);
            }
            totalSeconds += (checkOutTime - checkInTime) / 1000;
        }
    }
    return totalSeconds / 3600; // تحويل الثواني إلى ساعات
};


// @desc    Get timesheet records for an employee within a date range
// @route   GET /api/timesheets
// @access  Public
const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate } = req.query;

    if (!employeeName || !startDate || !endDate) {
        res.status(400);
        throw new Error('معلومات الاستعلام ناقصة (employeeName, startDate, endDate)');
    }

    const records = await Timesheet.find({
        employeeName: employeeName.toUpperCase(),
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.json(records);
});

// @desc    Create or update a timesheet entry (check-in/check-out) with face verification
// @route   POST /api/timesheets/entry
// @access  Public (relies on server-side face verification)
const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, faceDescriptor } = req.body;

    if (!employeeName || !faceDescriptor) {
        res.status(400);
        throw new Error('بصمة الوجه مطلوبة للتحقق.');
    }

    const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        res.status(401);
        throw new Error('لم يتم تسجيل بصمة الوجه لهذا الموظف.');
    }

    // --- Server-side Face Verification ---
    const registeredDescriptor = new Float32Array(employee.faceDescriptor);
    const queryDescriptor = new Float32Array(faceDescriptor);
    const distance = faceapi.euclideanDistance(registeredDescriptor, queryDescriptor);
    
    // A lower distance means a better match. 0.5 is a reasonable threshold.
    if (distance > 0.5) {
        res.status(401);
        throw new Error('الوجه غير مطابق. فشل التحقق.');
    }
    // --- Verification Successful ---

    let timesheet = await Timesheet.findOne({ employeeName: employee.name, date });

    if (!timesheet) {
        timesheet = new Timesheet({ employeeName: employee.name, date, entries: [] });
    }

    if (time && location) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
        timesheet.entries.push({ type: newEntryType, time, location });
    }

    timesheet.totalHours = calculateTotalHours(timesheet.entries);

    const updatedTimesheet = await timesheet.save();
    res.status(201).json(updatedTimesheet);
});


// @desc    Update a timesheet record manually (for admin)
// @route   PUT /api/timesheets/:id
// @access  Private
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
        throw new Error('سجل الدوام غير موجود');
    }
});


module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};

