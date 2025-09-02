const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    type: { type: String, enum: ['check-in', 'check-out'], required: true },
    time: { type: String, required: true },
    location: {
        lat: Number,
        lon: Number,
        name: String // <-- تمت إضافة حقل اسم الموقع
    }
});

const TimesheetSchema = new mongoose.Schema({
    employeeName: { type: String, required: true, uppercase: true },
    date: { type: String, required: true },
    entries: [entrySchema],
    totalHours: { type: Number, default: 0 },
}, {
    timestamps: true
});

TimesheetSchema.index({ employeeName: 1, date: 1 }, { unique: true });

const Timesheet = mongoose.model('Timesheet', TimesheetSchema);
module.exports = Timesheet;

