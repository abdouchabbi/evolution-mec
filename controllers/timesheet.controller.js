const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const { calculateDayHours, toLocalMidnight, getLocationName } = require('../utils/timesheet.helpers.js');

const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate, kioskId } = req.query;
    const filter = {};
    if (kioskId) {
        filter.kioskId = kioskId;
    }
    if (employeeName) {
        filter.employeeName = employeeName.toUpperCase();
    }
    if (startDate && endDate) {
        filter.date = { $gte: startDate, $lte: endDate };
    }
    const records = await Timesheet.find(filter).sort({ date: 'asc' });
    res.json(records);
});

const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { kioskId, employeeName, date, time, location, faceDescriptor, project, description } = req.body;
    if (!kioskId || !employeeName || !date || !time || !location || !faceDescriptor) {
        res.status(400);
        throw new Error('Incomplete registration data');
    }
    const employee = await Employee.findOne({ name: employeeName.toUpperCase(), kioskId: kioskId });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        res.status(401);
        throw new Error('Faceprint not registered for this employee');
    }

    const locationName = await getLocationName(location.lat, location.lon);
    const locationWithName = { ...location, name: locationName };
    let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date, kioskId: kioskId });

    if (timesheet) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
        timesheet.entries.push({ type: newEntryType, time, location: locationWithName, project, description });
    } else {
        timesheet = await Timesheet.create({
            kioskId: kioskId,
            employeeName: employeeName.toUpperCase(),
            date,
            entries: [{ type: 'check-in', time, location: locationWithName, project, description }],
        });
    }

    const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(date));
    timesheet.totalHours = total;
    timesheet.regularHours = regular;
    timesheet.overtimeHours = overtime;

    const updatedTimesheet = await timesheet.save();
    res.json(updatedTimesheet);
});

const updateTimesheet = asyncHandler(async (req, res) => {
    const timesheet = await Timesheet.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (timesheet) {
        timesheet.entries = req.body.entries || timesheet.entries;
        const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(timesheet.date));
        timesheet.totalHours = total;
        timesheet.regularHours = regular;
        timesheet.overtimeHours = overtime;
        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else {
        res.status(404);
        throw new Error('Timesheet record not found');
    }
});

module.exports = { getTimesheets, createOrUpdateEntry, updateTimesheet };