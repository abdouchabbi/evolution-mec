const asyncHandler = require("express-async-handler");
const Leave = require("../models/leave.model.js");

const getLeaveForEmployee = asyncHandler(async (req,res) => {
    const { employeeName, kioskId } = req.query;
    let query = {};
    if (kioskId) {
        query.kioskId = kioskId;
    } else if (req.kioskId) {
        query.kioskId = req.kioskId;
    }
    if (employeeName) { query.employeeName = employeeName.toUpperCase(); }
    const leaveRecords = await Leave.find(query).sort({ startDate: 'asc' });
    res.json(leaveRecords);
});

const createLeave = asyncHandler(async (req,res) => {
    const { employeeName, leaveType, startDate, endDate, reason } = req.body;
    if (!employeeName || !leaveType || !startDate || !endDate) { res.status(400); throw new Error('Please provide all required fields'); }
    const leave = await Leave.create({ employeeName, leaveType, startDate, endDate, reason, kioskId: req.kioskId });
    res.status(201).json(leave);
});

const deleteLeave = asyncHandler(async (req,res) => {
    const leaveRecord = await Leave.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (leaveRecord) { await leaveRecord.deleteOne(); res.json({ message: 'Leave record removed successfully' }); } else { res.status(404); throw new Error('Leave record not found'); }
});

module.exports = { getLeaveForEmployee, createLeave, deleteLeave };
