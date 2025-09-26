const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: [true, 'Employee name is required'], uppercase: true, trim: true },
    faceDescriptor: { type: [Number] },
    pin: { type: String },
    createdAt: { type: Date, default: Date.now },
});

employeeSchema.index({ name: 1, kioskId: 1 }, { unique: true });
employeeSchema.pre('save', async function (next) { 
    if (!this.isModified('pin')) { next(); return; } 
    if (this.pin) { const salt = await bcrypt.genSalt(10); this.pin = await bcrypt.hash(this.pin, salt); }
    next();
});
employeeSchema.methods.matchPin = async function (enteredPin) { if (!this.pin) return false; return await bcrypt.compare(enteredPin, this.pin); };
module.exports = mongoose.model('Employee', employeeSchema);
