const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    employeeName: { type: String, required: [true, 'Employee name is required'], uppercase: true },
    leaveType: { type: String, required: [true, 'Leave type is required'], trim: true },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['Approved', 'Pending', 'Rejected'], default: 'Approved' }
}, { timestamps: true });

module.exports = mongoose.model('Leave', LeaveSchema);
