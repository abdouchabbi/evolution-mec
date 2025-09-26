const asyncHandler = require('express-async-handler');
const Kiosk = require('../models/kiosk.model.js');

const validateKiosk = asyncHandler(async (req, res) => {
    const kiosk = await Kiosk.findById(req.params.kioskId);
    if (kiosk) {
        res.json({ kioskId: kiosk._id, companyName: kiosk.companyName });
    } else {
        res.status(404);
        throw new Error('Kiosk not found');
    }
});

module.exports = { validateKiosk };
