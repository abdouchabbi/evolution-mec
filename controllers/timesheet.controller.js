// -----------------------------------------------------------------------------
// ملف متحكم سجلات الدوام (controllers/timesheet.controller.js) - نسخة مطورة
// -----------------------------------------------------------------------------
// يحتوي الآن على منطق متقدم للتحقق من بصمة الوجه على الخادم.
// -----------------------------------------------------------------------------

const Timesheet = require('../models/timesheet.model');
const Employee = require('../models/employee.model');
const faceapi = require('face-api.js');

// --- دالة مساعدة لحساب إجمالي الساعات ---
const calculateTotalHours = (entries) => {
    let totalMilliseconds = 0;
    let lastCheckInTime = null;
    entries.sort((a, b) => a.time.localeCompare(b.time));
    for (const entry of entries) {
        if (entry.type === 'check-in') {
            lastCheckInTime = new Date(`1970-01-01T${entry.time}:00`);
        } else if (entry.type === 'check-out' && lastCheckInTime) {
            const checkOutTime = new Date(`1970-01-01T${entry.time}:00`);
            totalMilliseconds += (checkOutTime - lastCheckInTime);
            lastCheckInTime = null;
        }
    }
    return totalMilliseconds / (1000 * 60 * 60);
};

/**
 * @desc    جلب سجلات الدوام
 */
const getTimesheets = async (req, res) => {
    try {
        const { employeeName, startDate, endDate } = req.query;
        if (!employeeName || !startDate || !endDate) {
            return res.status(400).json({ message: 'المعلمات (employeeName, startDate, endDate) مطلوبة' });
        }
        const records = await Timesheet.find({
            employeeName: employeeName.toUpperCase(),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 'asc' });
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند جلب السجلات', error: error.message });
    }
};

/**
 * @desc    تسجيل حركة (دخول أو خروج) مع التحقق من الوجه
 */
const recordEntry = async (req, res) => {
    try {
        const { employeeName, date, time, location, project, description, faceDescriptor } = req.body;

        if (!employeeName || !date) {
            return res.status(400).json({ message: "اسم الموظف والتاريخ حقول مطلوبة." });
        }

        const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
        if (!employee) return res.status(404).json({ message: 'الموظف غير موجود' });

        // --- التحقق من الوجه على الخادم ---
        if (time && location) { // التحقق مطلوب فقط عند تسجيل حركة جديدة
            if (!faceDescriptor) return res.status(400).json({ message: "بصمة الوجه مطلوبة للتحقق." });
            if (!employee.faceDescriptor || employee.faceDescriptor.length === 0) {
                return res.status(400).json({ message: "لم يتم تسجيل بصمة الوجه لهذا الموظف." });
            }

            const storedDescriptor = new Float32Array(employee.faceDescriptor);
            const faceMatcher = new faceapi.FaceMatcher(storedDescriptor);
            const bestMatch = faceMatcher.findBestMatch(new Float32Array(faceDescriptor));

            if (bestMatch.label === 'unknown' || bestMatch.distance > 0.5) {
                return res.status(401).json({ message: "التحقق من الوجه فشل: الوجه غير مطابق." });
            }
        }
        
        let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });
        if (!timesheet) {
            timesheet = new Timesheet({ employeeName: employeeName.toUpperCase(), date, entries: [] });
        }

        if (time && location) {
            const lastEntry = timesheet.entries[timesheet.entries.length - 1];
            const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
            timesheet.entries.push({ type: newEntryType, time, location });
        }
        
        if (project !== undefined) timesheet.project = project;
        if (description !== undefined) timesheet.description = description;

        timesheet.totalHours = calculateTotalHours(timesheet.entries);
        const savedTimesheet = await timesheet.save();
        
        res.status(201).json(savedTimesheet);

    } catch (error) {
        console.error("خطأ فادح في تسجيل الحركة:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند تسجيل الحركة', error: error.message });
    }
};

module.exports = {
    getTimesheets,
    recordEntry
};
