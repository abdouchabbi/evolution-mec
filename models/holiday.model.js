const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: [true, 'Holiday name is required'], trim: true },
    date: { type: Date, required: [true, 'Holiday date is required'] }
}, { timestamps: true });

HolidaySchema.index({ date: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Holiday', HolidaySchema);
