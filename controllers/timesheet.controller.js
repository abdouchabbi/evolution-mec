const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const faceapi = require('face-api.js');
const fetch = require('node-fetch');

// @desc    Get timesheet records for an employee within a date range
// @route   GET /api/timesheets
// @access  Public (for Employee App) or Private (for Admin)
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

// @desc    Create or update a timesheet entry (check-in/check-out)
// @route   POST /api/timesheets/entry
// @access  Public
const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, faceDescriptor } = req.body;
    
    if (!employeeName || !date || !time || !location || !faceDescriptor) {
        res.status(400);
        throw new Error('بيانات التسجيل ناقصة');
    }

    const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        res.status(401);
        throw new Error('لم يتم تسجيل بصمة الوجه لهذا الموظف');
    }

    const faceMatcher = new faceapi.FaceMatcher([new Float32Array(employee.faceDescriptor)], 0.5);
    const bestMatch = faceMatcher.findBestMatch(new Float32Array(faceDescriptor));

    if (bestMatch.label === 'unknown') {
        res.status(401);
        throw new Error('الوجه غير مطابق، فشل التحقق');
    }

    // Reverse Geocoding to get location name
    let locationName = 'Unknown Location';
    try {
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lon}`);
        const geoData = await geoResponse.json();
        locationName = geoData.display_name || 'Unknown Location';
    } catch (error) {
        console.error("Geocoding error:", error);
    }
    
    const locationWithdName = { ...location, name: locationName };

    const timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });

    if (timesheet) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
        timesheet.entries.push({ type: newEntryType, time, location: locationWithdName });
        timesheet.totalHours = calculateTotalHours(timesheet.entries);
        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else {
        const newTimesheet = await Timesheet.create({
            employeeName: employeeName.toUpperCase(),
            date,
            entries: [{ type: 'check-in', time, location: locationWithdName }],
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
        timesheet.project = req.body.project !== undefined ? req.body.project : timesheet.project;
        timesheet.description = req.body.description !== undefined ? req.body.description : timesheet.description;
        timesheet.entries = req.body.entries || timesheet.entries;
        
        // Recalculate total hours after any update
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
 * It now handles overnight shifts correctly.
 */
function calculateTotalHours(entries) {
    let totalSeconds = 0;
    let checkInTime = null;

    const sortedEntries = [...entries].sort((a, b) => a.time.localeCompare(b.time));

    for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (entry.type === 'check-in') {
            checkInTime = entry.time;
            // Look for the next check-out
            const nextCheckOut = sortedEntries.slice(i + 1).find(e => e.type === 'check-out');
            if (nextCheckOut) {
                const start = new Date(`1970-01-01T${checkInTime}:00`);
                let end = new Date(`1970-01-01T${nextCheckOut.time}:00`);

                // Handle overnight shift
                if (end < start) {
                    end.setDate(end.getDate() + 1);
                }

                totalSeconds += (end - start) / 1000;
            }
        }
    }
    return totalSeconds / 3600; // Convert seconds to hours
}


module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};

