const express = require('express');
const router = express.Router();
const { validateKiosk } = require('../controllers/kiosk.controller.js');
router.get('/validate/:kioskId', validateKiosk);
module.exports = router;
