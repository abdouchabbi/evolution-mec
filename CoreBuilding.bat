@echo off
echo =======================================================
echo Lavoro Track - Complete Backend Builder
echo =======================================================
echo.

rem Create all necessary directories
echo [+] Creating directory structure...
mkdir config 2>nul
mkdir controllers 2>nul
mkdir middleware 2>nul
mkdir models 2>nul
mkdir routes 2>nul
mkdir services 2>nul
mkdir utils 2>nul
echo.

rem -----------------------------------------------------------------------------
rem --- Appending to .env file ---
rem -----------------------------------------------------------------------------
echo [+] Appending settings to .env file...
(
    echo.
    echo # --- Email Configuration (Mailtrap) ---
    echo EMAIL_HOST=smtp.mailtrap.io
    echo EMAIL_PORT=2525
    echo EMAIL_USER=YOUR_MAILTRAP_USER
    echo EMAIL_PASS=YOUR_MAILTRAP_PASSWORD
    echo EMAIL_FROM="Lavoro Track <no-reply@lavorotrack.com>"
) >> .env

rem -----------------------------------------------------------------------------
rem --- Creating utils/timesheet.helpers.js ---
rem -----------------------------------------------------------------------------
echo [+] Creating utils/timesheet.helpers.js...
(
    echo function toLocalMidnight(dateStr) {
    echo     return new Date(`${dateStr}T00:00:00`);
    echo }
    echo.
    echo function parseTimeToSeconds(t) {
    echo     if (typeof t !== 'string') return null;
    echo     const m = t.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
    echo     if (!m) return null;
    echo     const h = Number(m[1]), min = Number(m[2]), s = m[3] ? Number(m[3]) : 0;
    echo     if (h > 23) return null;
    echo     return h * 3600 + min * 60 + s;
    echo }
    echo.
    echo function mergeIntervals(intervals) {
    echo     if (intervals.length <= 1) return intervals;
    echo     intervals.sort((a, b) => a[0] - b[0]);
    echo     const merged = [];
    echo     let [cs, ce] = intervals[0];
    echo     for (let i = 1; i < intervals.length; i++) {
    echo         const [s, e] = intervals[i];
    echo         if (s <= ce) {
    echo             ce = Math.max(ce, e);
    echo         } else {
    echo             merged.push([cs, ce]);
    echo             [cs, ce] = [s, e];
    echo         }
    echo     }
    echo     merged.push([cs, ce]);
    echo     return merged;
    echo }
    echo.
    echo function calculateDayHours(entries, dateObject, options = {}) {
    echo     const roundTimeToNearestHalfHour = (seconds, direction) => {
    echo         const minutes = seconds / 60;
    echo         if (direction === 'up') {
    echo             return Math.ceil(minutes / 30) * 30 * 60;
    echo         } else {
    echo             return Math.floor(minutes / 30) * 30 * 60;
    echo         }
    echo     };
    echo.
    echo     const standardHours = options.standardHours ?? 8;
    echo     const weekendDays = options.weekendDays ?? [0, 6]; 
    echo     const standardDaySeconds = standardHours * 3600;
    echo.
    echo     const cleaned = entries
    echo         .filter(e => e && (e.type === 'check-in' || e.type === 'check-out'))
    echo         .map(e => ({ type: e.type, sec: parseTimeToSeconds(e.time) }))
    echo         .filter(e => e.sec !== null)
    echo         .sort((a, b) => a.sec - b.sec);
    echo.
    echo     const intervals = [];
    echo     let openIn = null;
    echo     for (const e of cleaned) {
    echo         if (e.type === 'check-in') {
    echo             openIn = e.sec;
    echo         } else {
    echo             if (openIn !== null) {
    echo                 let start = openIn;
    echo                 let end = e.sec;
    echo                 const roundedStart = roundTimeToNearestHalfHour(start, 'up');
    echo                 const roundedEnd = roundTimeToNearestHalfHour(end, 'down');
    echo                 if (roundedEnd > roundedStart) {
    echo                     intervals.push([roundedStart, roundedEnd]);
    echo                 }
    echo                 openIn = null;
    echo             }
    echo         }
    echo     }
    echo.
    echo     const merged = mergeIntervals(intervals);
    echo     let totalSeconds = 0;
    echo     for (const [s, e] of merged) totalSeconds += (e - s);
    echo.
    echo     const dayOfWeek = dateObject.getDay();
    echo     const isWeekend = weekendDays.includes(dayOfWeek);
    echo.
    echo     let regularSeconds = 0;
    echo     let overtimeSeconds = 0;
    echo.
    echo     if (isWeekend) {
    echo         overtimeSeconds = totalSeconds;
    echo     } else {
    echo         regularSeconds = Math.min(totalSeconds, standardDaySeconds);
    echo         overtimeSeconds = Math.max(0, totalSeconds - standardDaySeconds);
    echo     }
    echo     
    echo     const toHours = (sec) => Number((sec / 3600).toFixed(4));
    echo     const totalSecondsFinal = regularSeconds + overtimeSeconds;
    echo.
    echo     return {
    echo         total: toHours(totalSecondsFinal),
    echo         regular: toHours(regularSeconds),
    echo         overtime: toHours(overtimeSeconds),
    echo     };
    echo }
    echo.
    echo const getLocationName = async (lat, lon) => {
    echo     try {
    echo         const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it,en`);
    echo         if (!response.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    echo         const data = await response.json();
    echo         return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    echo     } catch (error) {
    echo         console.error("Geocoding Error:", error);
    echo         return 'Location unavailable';
    echo     }
    echo };
    echo.
    echo module.exports = { toLocalMidnight, parseTimeToSeconds, mergeIntervals, calculateDayHours, getLocationName };
) > utils\timesheet.helpers.js

rem -----------------------------------------------------------------------------
rem --- Creating Models ---
rem -----------------------------------------------------------------------------
echo [+] Creating ALL models...
(
    echo const mongoose = require('mongoose');
    echo.
    echo const KioskSchema = new mongoose.Schema({
    echo     companyName: { type: String, required: [true, 'Company name is required'], trim: true, unique: true },
    echo     owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    echo     contactEmail: { type: String, required: [true, 'Contact email is required'], trim: true, lowercase: true },
    echo     subscriptionStatus: { type: String, enum: ['active', 'inactive', 'trial'], default: 'trial' },
    echo     createdAt: { type: Date, default: Date.now }
    echo });
    echo.
    echo module.exports = mongoose.model('Kiosk', KioskSchema);
) > models\kiosk.model.js

(
    echo const mongoose = require('mongoose');
    echo const bcrypt = require('bcryptjs');
    echo.
    echo const UserSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     name: { type: String, required: [true, 'Please enter a name'] },
    echo     email: { type: String, required: [true, 'Please enter an email'], unique: true, match: [ /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email' ] },
    echo     username: { type: String, required: [true, 'Username is required'], unique: true },
    echo     password: { type: String, required: [true, 'Please enter a password'], minlength: 6, select: false },
    echo     passwordResetToken: String,
    echo     passwordResetExpires: Date,
    echo     createdAt: { type: Date, default: Date.now },
    echo });
    echo.
    echo UserSchema.pre('save', async function (next) { if (!this.isModified('password')) { next(); } const salt = await bcrypt.genSalt(10); this.password = await bcrypt.hash(this.password, salt); });
    echo UserSchema.methods.matchPassword = async function (enteredPassword) { return await bcrypt.compare(enteredPassword, this.password); };
    echo module.exports = mongoose.model('User', UserSchema);
) > models\user.model.js

(
    echo const mongoose = require('mongoose');
    echo const bcrypt = require('bcryptjs');
    echo.
    echo const employeeSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     name: { type: String, required: [true, 'Employee name is required'], uppercase: true, trim: true, },
    echo     faceDescriptor: { type: [Number], },
    echo     pin: { type: String, },
    echo     createdAt: { type: Date, default: Date.now, },
    echo });
    echo.
    echo employeeSchema.index({ name: 1, kioskId: 1 }, { unique: true });
    echo employeeSchema.pre('save', async function (next) { if (!this.isModified('pin')) { next(); } if (this.pin) { const salt = await bcrypt.genSalt(10); this.pin = await bcrypt.hash(this.pin, salt); } });
    echo employeeSchema.methods.matchPin = async function (enteredPin) { if (!this.pin) return false; return await bcrypt.compare(enteredPin, this.pin); };
    echo module.exports = mongoose.model('Employee', employeeSchema);
) > models\employee.model.js

(
    echo const mongoose = require('mongoose');
    echo.
    echo const ClientSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     name: { type: String, required: true, trim: true },
    echo     email: { type: String, required: false, trim: true, lowercase: true },
    echo     phone: { type: String, required: false, trim: true },
    echo     address: { type: String, required: false, trim: true },
    echo     createdAt: { type: Date, default: Date.now }
    echo });
    echo.
    echo ClientSchema.index({ name: 1, kioskId: 1 }, { unique: true });
    echo module.exports = mongoose.model('Client', ClientSchema);
) > models\client.model.js

(
    echo const mongoose = require('mongoose');
    echo.
    echo const ProjectSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     name: { type: String, required: true, trim: true },
    echo     clientName: { type: String, required: true },
    echo     rate: { type: Number, required: true },
    echo     createdAt: { type: Date, default: Date.now }
    echo });
    echo.
    echo ProjectSchema.index({ name: 1, kioskId: 1 }, { unique: true });
    echo module.exports = mongoose.model('Project', ProjectSchema);
) > models\project.model.js

(
    echo const mongoose = require('mongoose');
    echo.
    echo const HolidaySchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     name: { type: String, required: [true, 'Holiday name is required'], trim: true },
    echo     date: { type: Date, required: [true, 'Holiday date is required'] }
    echo }, { timestamps: true });
    echo.
    echo HolidaySchema.index({ date: 1, kioskId: 1 }, { unique: true });
    echo module.exports = mongoose.model('Holiday', HolidaySchema);
) > models\holiday.model.js

(
    echo const mongoose = require('mongoose');
    echo.
    echo const entrySchema = new mongoose.Schema({ type: { type: String, enum: ['check-in', 'check-out'], required: true }, time: { type: String, required: true }, location: { lat: Number, lon: Number, name: { type: String } }, project: { type: String }, description: { type: String } });
    echo.
    echo const TimesheetSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     employeeName: { type: String, required: true, uppercase: true },
    echo     date: { type: String, required: true },
    echo     entries: [entrySchema],
    echo     totalHours:   { type: Number, default: 0 },
    echo     regularHours: { type: Number, default: 0 },
    echo     overtimeHours:{ type: Number, default: 0 }
    echo });
    echo.
    echo TimesheetSchema.index({ employeeName: 1, date: 1, kioskId: 1 }, { unique: true });
    echo module.exports = mongoose.model('Timesheet', TimesheetSchema);
) > models\timesheet.model.js

(
    echo const mongoose = require('mongoose');
    echo.
    echo const LeaveSchema = new mongoose.Schema({
    echo     kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    echo     employeeName: { type: String, required: [true, 'Employee name is required'], uppercase: true },
    echo     leaveType: { type: String, required: [true, 'Leave type is required'], trim: true },
    echo     startDate: { type: Date, required: [true, 'Start date is required'] },
    echo     endDate: { type: Date, required: [true, 'End date is required'] },
    echo     reason: { type: String, trim: true },
    echo     status: { type: String, enum: ['Approved', 'Pending', 'Rejected'], default: 'Approved' }
    echo }, { timestamps: true });
    echo.
    echo module.exports = mongoose.model('Leave', LeaveSchema);
) > models\leave.model.js

rem -----------------------------------------------------------------------------
rem --- Creating Middleware ---
rem -----------------------------------------------------------------------------
echo [+] Creating middleware...
(
    echo const jwt = require('jsonwebtoken');
    echo const asyncHandler = require('express-async-handler');
    echo const User = require('../models/user.model.js');
    echo.
    echo const protect = asyncHandler(async (req, res, next) => {
    echo     let token;
    echo     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    echo         try {
    echo             token = req.headers.authorization.split(' ')[1];
    echo             const decoded = jwt.verify(token, process.env.JWT_SECRET);
    echo             req.user = await User.findById(decoded.id).select('-password');
    echo             if (!req.user || !req.user.kioskId) {
    echo                 res.status(401);
    echo                 throw new Error('User not found or not associated with a kiosk');
    echo             }
    echo             req.kioskId = req.user.kioskId;
    echo             next();
    echo         } catch (error) {
    echo             res.status(401);
    echo             throw new Error('Not authorized, token failed');
    echo         }
    echo     }
    echo     if (!token) {
    echo         res.status(401);
    echo         throw new Error('Not authorized, no token');
    echo     }
    echo });
    echo.
    echo module.exports = { protect };
) > middleware\auth.middleware.js

rem -----------------------------------------------------------------------------
rem --- Creating ALL Routes ---
rem -----------------------------------------------------------------------------
echo [+] Creating ALL routes...
(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { registerKiosk, loginUser, forgotPassword, resetPassword } = require('../controllers/auth.controller.js');
    echo router.post('/register', registerKiosk);
    echo router.post('/login', loginUser);
    echo router.post('/forgot-password', forgotPassword);
    echo router.post('/reset-password/:token', resetPassword);
    echo module.exports = router;
) > routes\auth.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { validateKiosk } = require('../controllers/kiosk.controller.js');
    echo router.get('/validate/:kioskId', validateKiosk);
    echo module.exports = router;
) > routes\kiosk.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getUserProfile, updateUserProfile, getUsers, deleteUser, updateUser, } = require('../controllers/user.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
    echo router.route('/').get(protect, getUsers);
    echo router.route('/:id').delete(protect, deleteUser).put(protect, updateUser);
    echo module.exports = router;
) > routes\user.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getEmployees, createEmployee, registerFace, setEmployeePin, deleteEmployee, getAllEmployeesForFaceLogin, verifyEmployeePin } = require('../controllers/employee.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.get('/face-login-data/:kioskId', getAllEmployeesForFaceLogin);
    echo router.post('/verify-pin', verifyEmployeePin);
    echo router.route('/').get(protect, getEmployees).post(protect, createEmployee);
    echo router.route('/face').post(protect, registerFace);
    echo router.route('/:id/set-pin').put(protect, setEmployeePin);
    echo router.route('/:id').delete(protect, deleteEmployee);
    echo module.exports = router;
) > routes\employee.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getClients, createClient, deleteClient, } = require('../controllers/client.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/').get(protect, getClients).post(protect, createClient);
    echo router.route('/:id').delete(protect, deleteClient);
    echo module.exports = router;
) > routes\client.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getProjects, createProject, deleteProject } = require('../controllers/project.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/').get(protect, getProjects).post(protect, createProject);
    echo router.route('/:id').delete(protect, deleteProject);
    echo module.exports = router;
) > routes\project.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getTimesheets, createOrUpdateEntry, updateTimesheet } = require('../controllers/timesheet.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/').get(getTimesheets);
    echo router.route('/entry').post(createOrUpdateEntry);
    echo router.route('/:id').put(protect, updateTimesheet);
    echo module.exports = router;
) > routes\timesheet.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getHolidays, createHoliday, deleteHoliday, } = require('../controllers/holiday.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/').get(getHolidays).post(protect, createHoliday);
    echo router.route('/:id').delete(protect, deleteHoliday);
    echo module.exports = router;
) > routes\holiday.routes.js

(
    echo const express = require('express');
    echo const router = express.Router();
    echo const { getLeaveForEmployee, createLeave, deleteLeave, } = require('../controllers/leave.controller.js');
    echo const { protect } = require('../middleware/auth.middleware.js');
    echo router.route('/').get(getLeaveForEmployee).post(protect, createLeave);
    echo router.route('/:id').delete(protect, deleteLeave);
    echo module.exports = router;
) > routes\leave.routes.js

rem -----------------------------------------------------------------------------
rem --- Creating ALL Controllers ---
rem -----------------------------------------------------------------------------
echo [+] Creating ALL controllers...
(
    echo const asyncHandler = require('express-async-handler');
    echo const crypto = require('crypto');
    echo const fs = require('fs');
    echo const path = require('path');
    echo const Kiosk = require('../models/kiosk.model.js');
    echo const User = require('../models/user.model.js');
    echo const generateToken = require('../utils/generateToken.js');
    echo const sendEmail = require('../services/email.service.js');
    echo.
    echo const registerKiosk = asyncHandler(async (req, res) => {
    echo     const { companyName, ownerName, email, password } = req.body;
    echo     if (!companyName || !ownerName || !email || !password) { res.status(400); throw new Error('Please provide all required fields'); }
    echo     const userExists = await User.findOne({ email });
    echo     if (userExists) { res.status(400); throw new Error('A user with this email already exists.'); }
    echo     const kioskExists = await Kiosk.findOne({ companyName });
    echo     if (kioskExists) { res.status(400); throw new Error('A company with this name already exists.'); }
    echo     const owner = new User({ name: ownerName, email, password, username: email, kioskId: null });
    echo     const kiosk = new Kiosk({ companyName, owner: owner._id, contactEmail: email });
    echo     owner.kioskId = kiosk._id;
    echo     await owner.save();
    echo     await kiosk.save();
    echo     if (owner && kiosk) {
    echo         res.status(201).json({ _id: owner._id, name: owner.name, email: owner.email, kioskId: owner.kioskId, token: generateToken(owner._id) });
    echo     } else { res.status(400); throw new Error('Failed to create kiosk and user.'); }
    echo });
    echo.
    echo const loginUser = asyncHandler(async (req, res) => {
    echo     const { email, password } = req.body;
    echo     const user = await User.findOne({ email }).select('+password');
    echo     if (user && (await user.matchPassword(password))) {
    echo         res.json({ _id: user._id, name: user.name, email: user.email, kioskId: user.kioskId, token: generateToken(user._id) });
    echo     } else { res.status(401); throw new Error('Invalid email or password'); }
    echo });
    echo.
    echo const forgotPassword = asyncHandler(async (req, res) => {
    echo     const { email } = req.body;
    echo     const user = await User.findOne({ email });
    echo     if (!user) { return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' }); }
    echo     const resetToken = crypto.randomBytes(20).toString('hex');
    echo     user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    echo     user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    echo     await user.save();
    echo     const resetUrl = `http://YOUR_FRONTEND_URL/reset-password/${resetToken}`;
    echo     try {
    echo         const templatePath = path.join(__dirname, '..', 'templates', 'passwordReset.html');
    echo         let htmlContent = fs.readFileSync(templatePath, 'utf8');
    echo         htmlContent = htmlContent.replace('{{resetUrl}}', resetUrl);
    echo         await sendEmail({ to: user.email, subject: 'Lavoro Track Password Reset', html: htmlContent });
    echo         res.status(200).json({ message: 'Password reset link sent to email.' });
    echo     } catch (err) {
    echo         user.passwordResetToken = undefined;
    echo         user.passwordResetExpires = undefined;
    echo         await user.save();
    echo         throw new Error('Email could not be sent');
    echo     }
    echo });
    echo.
    echo const resetPassword = asyncHandler(async (req, res) => {
    echo     const passwordResetToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    echo     const user = await User.findOne({ passwordResetToken, passwordResetExpires: { $gt: Date.now() } });
    echo     if (!user) { res.status(400); throw new Error('Invalid or expired token'); }
    echo     user.password = req.body.password;
    echo     user.passwordResetToken = undefined;
    echo     user.passwordResetExpires = undefined;
    echo     await user.save();
    echo     res.status(200).json({ message: 'Password has been reset successfully.' });
    echo });
    echo.
    echo module.exports = { registerKiosk, loginUser, forgotPassword, resetPassword };
) > controllers\auth.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Kiosk = require('../models/kiosk.model.js');
    echo.
    echo const validateKiosk = asyncHandler(async (req, res) => {
    echo     const kiosk = await Kiosk.findById(req.params.kioskId);
    echo     if (kiosk) {
    echo         res.json({ kioskId: kiosk._id, companyName: kiosk.companyName });
    echo     } else {
    echo         res.status(404);
    echo         throw new Error('Kiosk not found');
    echo     }
    echo });
    echo.
    echo module.exports = { validateKiosk };
) > controllers\kiosk.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const User = require('../models/user.model.js');
    echo const generateToken = require('../utils/generateToken.js');
    echo.
    echo const getUserProfile = asyncHandler(async (req, res) => { res.json({ _id: req.user._id, name: req.user.name, email: req.user.email }); });
    echo.
    echo const updateUserProfile = asyncHandler(async (req, res) => {
    echo     const user = await User.findById(req.user._id);
    echo     if (user) {
    echo         user.name = req.body.name || user.name;
    echo         if (req.body.password) { user.password = req.body.password; }
    echo         const updatedUser = await user.save();
    echo         res.json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, token: generateToken(updatedUser._id) });
    echo     } else { res.status(404); throw new Error('User not found'); }
    echo });
    echo.
    echo const getUsers = asyncHandler(async (req, res) => { const users = await User.find({ kioskId: req.kioskId }).select('-password'); res.json(users); });
    echo.
    echo const deleteUser = asyncHandler(async (req, res) => {
    echo     const user = await User.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (user) {
    echo         if(user._id.equals(req.user._id)) { res.status(400); throw new Error('You cannot delete your own account.'); }
    echo         await user.deleteOne();
    echo         res.json({ message: 'User deleted successfully' });
    echo     } else { res.status(404); throw new Error('User not found'); }
    echo });
    echo.
    echo const updateUser = asyncHandler(async (req, res) => {
    echo     const user = await User.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (user) {
    echo         user.name = req.body.name || user.name;
    echo         if (req.body.password) { user.password = req.body.password; }
    echo         const updatedUser = await user.save();
    echo         res.json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email });
    echo     } else { res.status(404); throw new Error('User not found'); }
    echo });
    echo.
    echo module.exports = { getUserProfile, updateUserProfile, getUsers, deleteUser, updateUser };
) > controllers\user.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Employee = require('../models/employee.model.js');
    echo const Timesheet = require('../models/timesheet.model.js');
    echo.
    echo const getEmployees = asyncHandler(async (req, res) => {
    echo     const employees = await Employee.find({ kioskId: req.kioskId });
    echo     const employeesWithStatus = employees.map((emp) => ({ _id: emp._id, name: emp.name, hasFaceDescriptor: emp.faceDescriptor && emp.faceDescriptor.length > 0, }));
    echo     res.json(employeesWithStatus);
    echo });
    echo.
    echo const createEmployee = asyncHandler(async (req, res) => {
    echo     const { name } = req.body;
    echo     const employeeExists = await Employee.findOne({ name: name.toUpperCase(), kioskId: req.kioskId });
    echo     if (employeeExists) { res.status(400); throw new Error('Employee already exists in this kiosk'); }
    echo     const employee = await Employee.create({ name: name.toUpperCase(), kioskId: req.kioskId });
    echo     res.status(201).json({ _id: employee._id, name: employee.name, hasFaceDescriptor: false, });
    echo });
    echo.
    echo const registerFace = asyncHandler(async (req, res) => {
    echo     const { employeeId, descriptor } = req.body;
    echo     const employee = await Employee.findOne({ _id: employeeId, kioskId: req.kioskId });
    echo     if (!employee) { res.status(404); throw new Error('Employee not found in your kiosk'); }
    echo     employee.faceDescriptor = descriptor;
    echo     await employee.save();
    echo     res.json({ message: 'Faceprint registered successfully' });
    echo });
    echo.
    echo const setEmployeePin = asyncHandler(async (req, res) => {
    echo     const { pin } = req.body;
    echo     if (!pin || !/^\d{4}$/.test(pin)) { res.status(400); throw new Error('PIN must be 4 digits'); }
    echo     const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (!employee) { res.status(404); throw new Error('Employee not found in your kiosk'); }
    echo     employee.pin = pin;
    echo     await employee.save();
    echo     res.json({ message: 'PIN set successfully' });
    echo });
    echo.
    echo const deleteEmployee = asyncHandler(async (req, res) => {
    echo     const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (employee) {
    echo         await Timesheet.deleteMany({ employeeName: employee.name, kioskId: req.kioskId });
    echo         await employee.deleteOne();
    echo         res.json({ message: 'Employee deleted successfully' });
    echo     } else { res.status(404); throw new Error('Employee not found in your kiosk'); }
    echo });
    echo.
    echo const getAllEmployeesForFaceLogin = asyncHandler(async (req, res) => {
    echo     const { kioskId } = req.params;
    echo     if (!kioskId) { res.status(400); throw new Error('Kiosk ID is required'); }
    echo     const employees = await Employee.find({ kioskId: kioskId, faceDescriptor: { $exists: true, $ne: [] } }).select('name faceDescriptor');
    echo     res.json(employees);
    echo });
    echo.
    echo const verifyEmployeePin = asyncHandler(async (req, res) => {
    echo     const { employeeId, pin } = req.body;
    echo     if (!employeeId || !pin) { res.status(400); throw new Error('Verification data is missing'); }
    echo     const employee = await Employee.findById(employeeId);
    echo     if (employee && (await employee.matchPin(pin))) {
    echo         res.json({ _id: employee._id, name: employee.name, kioskId: employee.kioskId });
    echo     } else { res.status(401); throw new Error('Incorrect PIN'); }
    echo });
    echo.
    echo module.exports = { getEmployees, createEmployee, registerFace, setEmployeePin, deleteEmployee, getAllEmployeesForFaceLogin, verifyEmployeePin };
) > controllers\employee.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Client = require('../models/client.model.js');
    echo const Project = require('../models/project.model.js');
    echo.
    echo const getClients = asyncHandler(async (req, res) => { const clients = await Client.find({ kioskId: req.kioskId }); res.json(clients); });
    echo.
    echo const createClient = asyncHandler(async (req, res) => {
    echo     const { name, email, phone, address } = req.body;
    echo     if (!name) { res.status(400); throw new Error('Client name is required'); }
    echo     const clientExists = await Client.findOne({ name, kioskId: req.kioskId });
    echo     if (clientExists) { res.status(400); throw new Error('Client already exists in this kiosk'); }
    echo     const client = await Client.create({ name, email, phone, address, kioskId: req.kioskId });
    echo     res.status(201).json(client);
    echo });
    echo.
    echo const deleteClient = asyncHandler(async (req, res) => {
    echo     const client = await Client.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (client) {
    echo         await Project.deleteMany({ clientName: client.name, kioskId: req.kioskId });
    echo         await client.deleteOne();
    echo         res.json({ message: 'Client and associated projects have been deleted' });
    echo     } else { res.status(404); throw new Error('Client not found'); }
    echo });
    echo.
    echo module.exports = { getClients, createClient, deleteClient };
) > controllers\client.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Project = require('../models/project.model.js');
    echo.
    echo const getProjects = asyncHandler(async (req, res) => { const projects = await Project.find({ kioskId: req.kioskId }); res.json(projects); });
    echo.
    echo const createProject = asyncHandler(async (req, res) => {
    echo     const { name, clientName, rate } = req.body;
    echo     if (!name || !clientName || !rate) { res.status(400); throw new Error('Please fill in all project fields'); }
    echo     const projectExists = await Project.findOne({ name, kioskId: req.kioskId });
    echo     if (projectExists) { res.status(400); throw new Error('Project already exists'); }
    echo     const project = await Project.create({ name, clientName, rate, kioskId: req.kioskId });
    echo     res.status(201).json(project);
    echo });
    echo.
    echo const deleteProject = asyncHandler(async (req, res) => {
    echo     const project = await Project.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (project) {
    echo         await project.deleteOne();
    echo         res.json({ message: 'Project deleted successfully' });
    echo     } else { res.status(404); throw new Error('Project not found'); }
    echo });
    echo.
    echo module.exports = { getProjects, createProject, deleteProject };
) > controllers\project.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Holiday = require('../models/holiday.model.js');
    echo.
    echo const getHolidays = asyncHandler(async (req, res) => {
    echo     const { kioskId } = req.query;
    echo     let query = {};
    echo     if (kioskId) { query.kioskId = kioskId; }
    echo     const holidays = await Holiday.find(query).sort({ date: 'asc' });
    echo     res.json(holidays);
    echo });
    echo.
    echo const createHoliday = asyncHandler(async (req, res) => {
    echo     const { name, date } = req.body;
    echo     if (!name || !date) { res.status(400); throw new Error('Please enter name and date'); }
    echo     const holiday = await Holiday.create({ name, date, kioskId: req.kioskId });
    echo     res.status(201).json(holiday);
    echo });
    echo.
    echo const deleteHoliday = asyncHandler(async (req, res) => {
    echo     const holiday = await Holiday.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (holiday) {
    echo         await holiday.deleteOne();
    echo         res.json({ message: 'Holiday deleted successfully' });
    echo     } else { res.status(404); throw new Error('Holiday not found'); }
    echo });
    echo.
    echo module.exports = { getHolidays, createHoliday, deleteHoliday };
) > controllers\holiday.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Leave = require('../models/leave.model.js');
    echo.
    echo const getLeaveForEmployee = asyncHandler(async (req, res) => {
    echo     const { employeeName, kioskId } = req.query;
    echo     let query = {};
    echo     if (kioskId) {
    echo         query.kioskId = kioskId;
    echo     } else if (req.kioskId) {
    echo         query.kioskId = req.kioskId;
    echo     }
    echo     if (employeeName) { query.employeeName = employeeName.toUpperCase(); }
    echo     const leaveRecords = await Leave.find(query).sort({ startDate: 'asc' });
    echo     res.json(leaveRecords);
    echo });
    echo.
    echo const createLeave = asyncHandler(async (req, res) => {
    echo     const { employeeName, leaveType, startDate, endDate, reason } = req.body;
    echo     if (!employeeName || !leaveType || !startDate || !endDate) { res.status(400); throw new Error('Please provide all required fields'); }
    echo     const leave = await Leave.create({ employeeName, leaveType, startDate, endDate, reason, kioskId: req.kioskId });
    echo     res.status(201).json(leave);
    echo });
    echo.
    echo const deleteLeave = asyncHandler(async (req, res) => {
    echo     const leaveRecord = await Leave.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (leaveRecord) {
    echo         await leaveRecord.deleteOne();
    echo         res.json({ message: 'Leave record removed successfully' });
    echo     } else { res.status(404); throw new Error('Leave record not found'); }
    echo });
    echo.
    echo module.exports = { getLeaveForEmployee, createLeave, deleteLeave };
) > controllers\leave.controller.js

(
    echo const asyncHandler = require('express-async-handler');
    echo const Timesheet = require('../models/timesheet.model.js');
    echo const Employee = require('../models/employee.model.js');
    echo const faceapi = require('face-api.js');
    echo const { calculateDayHours, toLocalMidnight, getLocationName } = require('../utils/timesheet.helpers.js');
    echo.
    echo const getTimesheets = asyncHandler(async (req, res) => {
    echo     const { employeeName, startDate, endDate, kioskId } = req.query;
    echo     const filter = {};
    echo     if (kioskId) { filter.kioskId = kioskId; }
    echo     if (employeeName) { filter.employeeName = employeeName.toUpperCase(); }
    echo     if (startDate && endDate) { filter.date = { $gte: startDate, $lte: endDate }; }
    echo     const records = await Timesheet.find(filter).sort({ date: 'asc' });
    echo     res.json(records);
    echo });
    echo.
    echo const createOrUpdateEntry = asyncHandler(async (req, res) => {
    echo     const { kioskId, employeeName, date, time, location, faceDescriptor, project, description } = req.body;
    echo     if (!kioskId || !employeeName || !date || !time || !location || !faceDescriptor) { res.status(400); throw new Error('Incomplete registration data'); }
    echo     const employee = await Employee.findOne({ name: employeeName.toUpperCase(), kioskId: kioskId });
    echo     if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) { res.status(401); throw new Error('Faceprint not registered for this employee'); }
    echo     const faceMatcher = new faceapi.FaceMatcher([new Float32Array(employee.faceDescriptor)], 0.5);
    echo     const bestMatch = faceMatcher.findBestMatch(new Float32Array(faceDescriptor));
    echo     if (bestMatch.label === 'unknown') { res.status(401); throw new Error('Face does not match, verification failed'); }
    echo     const locationName = await getLocationName(location.lat, location.lon);
    echo     const locationWithdName = { ...location, name: locationName };
    echo     let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date, kioskId: kioskId });
    echo     if (timesheet) {
    echo         const lastEntry = timesheet.entries[timesheet.entries.length - 1];
    echo         const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
    echo         timesheet.entries.push({ type: newEntryType, time, location: locationWithdName, project, description });
    echo     } else {
    echo         timesheet = await Timesheet.create({ kioskId: kioskId, employeeName: employeeName.toUpperCase(), date, entries: [{ type: 'check-in', time, location: locationWithdName, project, description }], });
    echo     }
    echo     const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(date));
    echo     timesheet.totalHours = total;
    echo     timesheet.regularHours = regular;
    echo     timesheet.overtimeHours = overtime;
    echo     const updatedTimesheet = await timesheet.save();
    echo     res.json(updatedTimesheet);
    echo });
    echo.
    echo const updateTimesheet = asyncHandler(async (req, res) => {
    echo     const timesheet = await Timesheet.findOne({ _id: req.params.id, kioskId: req.kioskId });
    echo     if (timesheet) {
    echo         timesheet.entries = req.body.entries || timesheet.entries;
    echo         const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(timesheet.date));
    echo         timesheet.totalHours = total;
    echo         timesheet.regularHours = regular;
    echo         timesheet.overtimeHours = overtime;
    echo         const updatedTimesheet = await timesheet.save();
    echo         res.json(updatedTimesheet);
    echo     } else { res.status(404); throw new Error('Timesheet record not found'); }
    echo });
    echo.
    echo module.exports = { getTimesheets, createOrUpdateEntry, updateTimesheet };
) > controllers\timesheet.controller.js

echo.
echo ========================================================================
echo [+] ALL SERVER FILES HAVE BEEN CREATED/UPDATED SUCCESSFULLY.
echo ========================================================================
echo.
echo !!! IMPORTANT NEXT STEPS !!!
echo 1. Open the .env file and fill in your Database and Mailtrap credentials.
echo 2. In controllers\auth.controller.js, replace 'YOUR_FRONTEND_URL' with your actual frontend domain.
echo 3. In your terminal, run 'npm install' to get all necessary packages.
echo 4. Create the 'templates' folder with 'welcome.html' and 'passwordReset.html'.
echo.
pause