// -----------------------------------------------------------------------------
// ملف متحكم سجلات الدوام (controllers/timesheet.controller.js) - محدث
// -----------------------------------------------------------------------------
const Timesheet = require('../models/timesheet.model');
const Employee = require('../models/employee.model');
const mongoose = require('mongoose');
const faceapi = require('face-api.js');

// --- Helper Function to calculate hours ---
function calculateTotalHours(entries) {
    let totalSeconds = 0;
    // Ensure we have pairs of check-in and check-out
    for (let i = 0; i < entries.length - 1; i += 2) {
        const entryIn = entries[i];
        const entryOut = entries[i + 1];

        if (entryIn.type === 'check-in' && entryOut.type === 'check-out') {
            // Create date objects to calculate difference accurately
            const timeIn = new Date(`1970-01-01T${entryIn.time}:00`);
            const timeOut = new Date(`1970-01-01T${entryOut.time}:00`);

            if (timeOut > timeIn) {
                const diffSeconds = (timeOut.getTime() - timeIn.getTime()) / 1000;
                totalSeconds += diffSeconds;
            }
        }
    }
    return totalSeconds;
}


/**
 * @desc    جلب سجلات الدوام لموظف معين خلال فترة زمنية
 * @route   GET /api/timesheets
 * @access  Public
 */
const getTimesheets = async (req, res) => {
    try {
        const { employeeName, startDate, endDate } = req.query;
        if (!employeeName || !startDate || !endDate) {
            return res.status(400).json({ message: 'اسم الموظف وتاريخ البداية والنهاية مطلوب' });
        }
        const records = await Timesheet.find({
            employeeName: employeeName.toUpperCase(),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 'asc' });

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند جلب سجلات الدوام', error: error.message });
    }
};

/**
 * @desc    تسجيل حركة دخول أو خروج جديدة مع التحقق من الوجه
 * @route   POST /api/timesheets/entry
 * @access  Public
 */
const recordEntry = async (req, res) => {
    try {
        const { employeeName, date, time, location, project, description, faceDescriptor } = req.body;
        
        // --- Face Verification on Server ---
        if (!faceDescriptor) {
            return res.status(400).json({ message: "بصمة الوجه مطلوبة للتحقق." });
        }
        
        const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
        if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
            return res.status(404).json({ message: "لم يتم العثور على بصمة وجه مسجلة لهذا الموظف." });
        }

        const registeredDescriptor = new Float32Array(employee.faceDescriptor);
        const newDescriptor = new Float32Array(faceDescriptor);
        const distance = faceapi.euclideanDistance(registeredDescriptor, newDescriptor);

        if (distance > 0.5) { // 0.5 is a common threshold
            return res.status(401).json({ message: "الوجه غير مطابق. فشل التحقق." });
        }
        // --- End Face Verification ---

        const timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date: date });

        if (timesheet) {
            // Update existing record
            if (time && location) { // This is a check-in/out entry
                const lastEntry = timesheet.entries[timesheet.entries.length - 1];
                const newEntryType = (!lastEntry || lastEntry.type === 'check-out') ? 'check-in' : 'check-out';
                timesheet.entries.push({ type: newEntryType, time, location });
            }
            if (project) timesheet.project = project;
            if (description) timesheet.description = description;
            
            // Recalculate hours
            const totalSeconds = calculateTotalHours(timesheet.entries);
            timesheet.totalHours = totalSeconds / 3600; // Convert to hours
            
            await timesheet.save();
            res.status(200).json(timesheet);

        } else {
            // Create new record for the day
            const newTimesheetData = {
                employeeName: employeeName.toUpperCase(),
                date,
                project,
                description,
                entries: []
            };
            if (time && location) {
                newTimesheetData.entries.push({ type: 'check-in', time, location });
            }
            const newTimesheet = new Timesheet(newTimesheetData);
            await newTimesheet.save();
            res.status(201).json(newTimesheet);
        }

    } catch (error) {
        console.error("Entry Error:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند تسجيل الحركة', error: error.message });
    }
};

/**
 * @desc    تحديث سجل دوام (للمدير)
 * @route   PUT /api/timesheets/:id
 * @access  Admin
 */
const updateTimesheet = async (req, res) => {
    const { id } = req.params;
    const { project, description, entries } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "صيغة معرّف سجل الدوام غير صالحة" });
    }

    try {
        const timesheet = await Timesheet.findById(id);
        if (!timesheet) {
            return res.status(404).json({ message: 'سجل الدوام غير موجود' });
        }

        // Update fields if they are provided in the request
        if (project !== undefined) timesheet.project = project;
        if (description !== undefined) timesheet.description = description;
        if (entries !== undefined) timesheet.entries = entries;

        // Recalculate total hours based on the new entries
        const totalSeconds = calculateTotalHours(timesheet.entries);
        timesheet.totalHours = totalSeconds / 3600; // Convert seconds to hours

        const updatedTimesheet = await timesheet.save();
        res.status(200).json(updatedTimesheet);

    } catch (error) {
        console.error("خطأ في تحديث سجل الدوام:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند تحديث سجل الدوام' });
    }
};


module.exports = {
    getTimesheets,
    recordEntry,
    updateTimesheet // Export the new function
};
