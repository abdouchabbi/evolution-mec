const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: true, trim: true },
    clientName: { type: String, required: true },
    rate: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

ProjectSchema.index({ name: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Project', ProjectSchema);
