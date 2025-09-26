const mongoose = require('mongoose');

const KioskSchema = new mongoose.Schema({
    companyName: { type: String, required: [true, 'Company name is required'], trim: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    contactEmail: { type: String, required: [true, 'Contact email is required'], trim: true, lowercase: true },
    subscriptionStatus: { type: String, enum: ['active', 'inactive', 'trial'], default: 'trial' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Kiosk', KioskSchema);
