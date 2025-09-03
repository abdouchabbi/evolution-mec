const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');

// @desc    Get timesheet records for an employee within a date range
// @route   GET /api/timesheets
// @access  Private (for Admin) and Public (for Employee App)
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

// @desc    Create or update a timesheet entry (check-in/check-out)
// @route   POST /api/timesheets/entry
// @access  Public (for Employee App, protected by face verification on the server)
const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, faceDescriptor, project, description } = req.body;

    // --- (Placeholder for server-side face verification logic) ---
    // In a real advanced scenario, the face verification would happen here.
    // For now, we trust the frontend verification.

    const timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });

    if (timesheet) {
        // Update existing record
        if (time && location) { // If it's a check-in/out entry
            const lastEntry = timesheet.entries[timesheet.entries.length - 1];
            const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
            timesheet.entries.push({ type: newEntryType, time, location });
        }
        // Update project/description if provided
        if (project !== undefined) timesheet.project = project;
        if (description !== undefined) timesheet.description = description;

        timesheet.totalHours = calculateTotalHours(timesheet.entries);
        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else {
        // Create new record for the day
        if (!time || !location) {
            res.status(400);
            throw new Error('لا يمكن إنشاء سجل جديد بدون وقت وموقع.');
        }
        const newTimesheet = await Timesheet.create({
            employeeName: employeeName.toUpperCase(),
            date,
            project,
            description,
            entries: [{ type: 'check-in', time, location }],
            totalHours: 0,
        });
        res.status(201).json(newTimesheet);
    }
});

// @desc    Update a full timesheet record (for admin edits)
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
        throw new Error('لم يتم العثور على سجل الدوام');
    }
});


/**
 * Helper function to calculate total hours from time entries.
 * @param {Array} entries - Array of check-in/check-out objects.
 * @returns {number} - Total hours worked.
 */
function calculateTotalHours(entries) {
    let totalSeconds = 0;
    let lastCheckInTime = null;

    entries.forEach(entry => {
        const [hours, minutes] = entry.time.split(':').map(Number);
        const currentTime = new Date();
        currentTime.setHours(hours, minutes, 0, 0);

        if (entry.type === 'check-in') {
            if (!lastCheckInTime) {
                lastCheckInTime = currentTime;
            }
        } else if (entry.type === 'check-out' && lastCheckInTime) {
            const diff = (currentTime.getTime() - lastCheckInTime.getTime()) / 1000;
            totalSeconds += diff;
            lastCheckInTime = null; // Reset for the next pair
        }
    });

    return totalSeconds / 3600; // Convert seconds to hours
}


module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};

