const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['check-in', 'check-out'],
        required: true,
    },
    time: {
        type: String, // HH:MM
        required: true,
    },
    location: {
        lat: Number,
        lon: Number,
        name: String, // سيتم تخزين اسم الموقع هنا
    },
});

const timesheetSchema = new mongoose.Schema({
    employeeName: {
        type: String,
        required: true,
        uppercase: true,
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true,
    },
    project: {
        type: String,
    },
    description: {
        type: String,
    },
    entries: [entrySchema],
    totalHours: {
        type: Number,
        default: 0,
    },
    regularHours: { // ساعات العمل العادية
        type: Number,
        default: 0
    },
    overtimeHours: { // ساعات العمل الإضافية
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
});

timesheetSchema.index({ employeeName: 1, date: 1 }, { unique: true });

const Timesheet = mongoose.model('Timesheet', timesheetSchema);

module.exports = Timesheet;

