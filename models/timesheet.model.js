const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['check-in', 'check-out', 'break-start', 'break-end'], 
        required: true 
    },
    time: { type: String, required: true }, // Format 'HH:MM' or 'HH:MM:SS'
    location: {
        lat: Number,
        lon: Number,
        name: { type: String }
    },
    // تم نقل المشروع والوصف إلى مستوى الحركة لتتبع دقيق
    project: { type: String },
    description: { type: String }
});

const TimesheetSchema = new mongoose.Schema({
    employeeName: { type: String, required: true, uppercase: true },
    date: { type: String, required: true }, // Format 'YYYY-MM-DD'
    entries: [entrySchema],

    // الحقول الخاصة بالحسابات
    totalHours:   { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours:{ type: Number, default: 0 }
});

// فهرس لضمان عدم تكرار سجل لنفس الموظف في نفس التاريخ
TimesheetSchema.index({ employeeName: 1, date: 1 }, { unique: true });

const Timesheet = mongoose.model('Timesheet', TimesheetSchema);

module.exports = Timesheet;
