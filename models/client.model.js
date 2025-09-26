const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: false, trim: true, lowercase: true },
    phone: { type: String, required: false, trim: true },
    address: { type: String, required: false, trim: true },
    createdAt: { type: Date, default: Date.now }
});

ClientSchema.index({ name: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Client', ClientSchema);
