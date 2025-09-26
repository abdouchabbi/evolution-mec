const express = require('express');
const router = express.Router();
const { registerKiosk, loginUser, forgotPassword, resetPassword } = require('../controllers/auth.controller.js');
router.post('/register', registerKiosk);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
module.exports = router;
