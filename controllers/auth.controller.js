const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Kiosk = require('../models/kiosk.model.js');
const User = require('../models/user.model.js');
const generateToken = require('../utils/generateToken.js');
const sendEmail = require('../services/email.service.js');

const registerKiosk = asyncHandler(async (req, res) => {
    const { companyName, ownerName, email, password } = req.body;
    if (!companyName || !ownerName || !email || !password) { res.status(400); throw new Error('Please provide all required fields'); }
    const userExists = await User.findOne({ email });
    if (userExists) { res.status(400); throw new Error('A user with this email already exists.'); }
    const kioskExists = await Kiosk.findOne({ companyName });
    if (kioskExists) { res.status(400); throw new Error('A company with this name already exists.'); }
    const owner = new User({ name: ownerName, email, password, username: email, kioskId: null });
    const kiosk = new Kiosk({ companyName, owner: owner._id, contactEmail: email });
    owner.kioskId = kiosk._id;
    await owner.save();
    await kiosk.save();
    if (owner && kiosk) {
        res.status(201).json({ _id: owner._id, name: owner.name, email: owner.email, kioskId: owner.kioskId, token: generateToken(owner._id) });
    } else { res.status(400); throw new Error('Failed to create kiosk and user.'); }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (user && (await user.matchPassword(password))) {
        res.json({ _id: user._id, name: user.name, email: user.email, kioskId: user.kioskId, token: generateToken(user._id) });
    } else { res.status(401); throw new Error('Invalid email or password'); }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) { return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' }); }
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    const resetUrl = `http://YOUR_FRONTEND_URL/reset-password/${resetToken}`;
    try {
        const templatePath = path.join(__dirname, '..', 'templates', 'passwordReset.html');
        let htmlContent = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : `<a href="${resetUrl}">Reset</a>`;
        htmlContent = htmlContent.replace('{{resetUrl}}', resetUrl);
        await sendEmail({ to: user.email, subject: 'Lavoro Track Password Reset', html: htmlContent });
        res.status(200).json({ message: 'Password reset link sent to email.' });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        throw new Error('Email could not be sent');
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const passwordResetToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ passwordResetToken, passwordResetExpires: { $gt: Date.now() } });
    if (!user) { res.status(400); throw new Error('Invalid or expired token'); }
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.status(200).json({ message: 'Password has been reset successfully.' });
});

module.exports = { registerKiosk, loginUser, forgotPassword, resetPassword };
