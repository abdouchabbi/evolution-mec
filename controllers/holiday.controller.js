const asyncHandler = require("express-async-handler");
const Holiday = require("../models/holiday.model.js");

const getHolidays = asyncHandler(async (req,res) => {
    const { kioskId } = req.query;
    let query = {};
    if (kioskId) { query.kioskId = kioskId; }
    const holidays = await Holiday.find(query).sort({ date: "asc" });
    res.json(holidays);
});

const createHoliday = asyncHandler(async (req,res) => {
    const { name, date } = req.body;
    if (!name || !date) { res.status(400); throw new Error("Please enter name and date"); }
    const holiday = await Holiday.create({ name, date, kioskId: req.kioskId });
    res.status(201).json(holiday);
});

const deleteHoliday = asyncHandler(async (req,res) => {
    const holiday = await Holiday.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (holiday) { await holiday.deleteOne(); res.json({ message: "Holiday deleted successfully" }); } else { res.status(404); throw new Error("Holiday not found"); }
});

module.exports = { getHolidays, createHoliday, deleteHoliday };
