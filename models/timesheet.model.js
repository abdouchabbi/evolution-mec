const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    type: { type: String, enum: ['check-in', 'check-out'], required: true },
    time: { type: String, required: true },
    location: { lat: Number, lon: Number, name: { type: String } },
    project: { type: String },
    description: { type: String }
});

const TimesheetSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    employeeName: { type: String, required: true, uppercase: true },
    date: { type: String, required: true },
    entries: [entrySchema],
    totalHours:   { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours:{ type: Number, default: 0 }
});

TimesheetSchema.index({ employeeName: 1, date: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Timesheet', TimesheetSchema);
