# setup.ps1
# Run with: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; .\setup.ps1

$dirs = @('config','controllers','middleware','models','routes','services','utils','templates')
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

Write-Host "[+] Directories ensured."

# optional: remove previously created files that might be broken
# Uncomment next lines if you want to force-delete old generated files
# Get-ChildItem -Path models,controllers,routes,middleware,utils,services -File -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "[+] Creating files..."

# .env (append if exists)
$envContent = @'
# --- Email Configuration (Mailtrap) ---
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=YOUR_MAILTRAP_USER
EMAIL_PASS=YOUR_MAILTRAP_PASSWORD
EMAIL_FROM="Lavoro Track <no-reply@lavorotrack.com>"
# Add: MONGO_URI=your_mongo_connection_string
# Add: JWT_SECRET=your_jwt_secret
'@
if (-not (Test-Path .env)) {
    $envContent | Set-Content -Path .env -Encoding UTF8
} else {
    $envContent | Out-File -FilePath .env -Encoding UTF8 -Append
}

# utils/timesheet.helpers.js
$timesheetHelpers = @'
function toLocalMidnight(dateStr) {
    return new Date(`${dateStr}T00:00:00`);
}

function parseTimeToSeconds(t) {
    if (typeof t !== 'string') return null;
    const m = t.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]), s = m[3] ? Number(m[3]) : 0;
    if (h > 23) return null;
    return h * 3600 + min * 60 + s;
}

function mergeIntervals(intervals) {
    if (!intervals || intervals.length <= 1) return intervals || [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    let [cs, ce] = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        const [s, e] = intervals[i];
        if (s <= ce) {
            ce = Math.max(ce, e);
        } else {
            merged.push([cs, ce]);
            [cs, ce] = [s, e];
        }
    }
    merged.push([cs, ce]);
    return merged;
}

function calculateDayHours(entries, dateObject, options = {}) {
    const roundTimeToNearestHalfHour = (seconds, direction) => {
        const minutes = seconds / 60;
        if (direction === 'up') {
            return Math.ceil(minutes / 30) * 30 * 60;
        } else {
            return Math.floor(minutes / 30) * 30 * 60;
        }
    };

    const standardHours = options.standardHours ?? 8;
    const weekendDays = options.weekendDays ?? [0, 6]; 
    const standardDaySeconds = standardHours * 3600;

    const cleaned = (entries || [])
        .filter(e => e && (e.type === 'check-in' || e.type === 'check-out'))
        .map(e => ({ type: e.type, sec: parseTimeToSeconds(e.time) }))
        .filter(e => e.sec !== null)
        .sort((a, b) => a.sec - b.sec);

    const intervals = [];
    let openIn = null;
    for (const e of cleaned) {
        if (e.type === 'check-in') {
            openIn = e.sec;
        } else {
            if (openIn !== null) {
                let start = openIn;
                let end = e.sec;
                const roundedStart = roundTimeToNearestHalfHour(start, 'up');
                const roundedEnd = roundTimeToNearestHalfHour(end, 'down');
                if (roundedEnd > roundedStart) {
                    intervals.push([roundedStart, roundedEnd]);
                }
                openIn = null;
            }
        }
    }

    const merged = mergeIntervals(intervals);
    let totalSeconds = 0;
    for (const [s, e] of merged) totalSeconds += (e - s);

    const dayOfWeek = dateObject.getDay();
    const isWeekend = weekendDays.includes(dayOfWeek);

    let regularSeconds = 0;
    let overtimeSeconds = 0;

    if (isWeekend) {
        overtimeSeconds = totalSeconds;
    } else {
        regularSeconds = Math.min(totalSeconds, standardDaySeconds);
        overtimeSeconds = Math.max(0, totalSeconds - standardDaySeconds);
    }
    
    const toHours = (sec) => Number((sec / 3600).toFixed(4));
    const totalSecondsFinal = regularSeconds + overtimeSeconds;

    return {
        total: toHours(totalSecondsFinal),
        regular: toHours(regularSeconds),
        overtime: toHours(overtimeSeconds),
    };
}

const getLocationName = async (lat, lon) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it,en`);
        if (!response.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
        console.error("Geocoding Error:", error);
        return 'Location unavailable';
    }
};

module.exports = { toLocalMidnight, parseTimeToSeconds, mergeIntervals, calculateDayHours, getLocationName };
'@
$timesheetHelpers | Set-Content -Path utils\timesheet.helpers.js -Encoding UTF8

# models/kiosk.model.js
$kioskModel = @'
const mongoose = require('mongoose');

const KioskSchema = new mongoose.Schema({
    companyName: { type: String, required: [true, 'Company name is required'], trim: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    contactEmail: { type: String, required: [true, 'Contact email is required'], trim: true, lowercase: true },
    subscriptionStatus: { type: String, enum: ['active', 'inactive', 'trial'], default: 'trial' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Kiosk', KioskSchema);
'@
$kioskModel | Set-Content -Path models\kiosk.model.js -Encoding UTF8

# models/user.model.js
$userModel = @'
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: [true, 'Please enter a name'] },
    email: { type: String, required: [true, 'Please enter an email'], unique: true, match: [ /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email' ] },
    username: { type: String, required: [true, 'Username is required'], unique: true },
    password: { type: String, required: [true, 'Please enter a password'], minlength: 6, select: false },
    passwordResetToken: String,
    passwordResetExpires: Date,
    createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function (next) { 
    if (!this.isModified('password')) { next(); return; } 
    const salt = await bcrypt.genSalt(10); 
    this.password = await bcrypt.hash(this.password, salt); 
    next();
});
UserSchema.methods.matchPassword = async function (enteredPassword) { return await bcrypt.compare(enteredPassword, this.password); };
module.exports = mongoose.model('User', UserSchema);
'@
$userModel | Set-Content -Path models\user.model.js -Encoding UTF8

# models/employee.model.js
$employeeModel = @'
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
'@
$employeeModel | Set-Content -Path models\employee.model.js -Encoding UTF8

# models/client.model.js
$clientModel = @'
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
'@
$clientModel | Set-Content -Path models\client.model.js -Encoding UTF8

# models/project.model.js
$projectModel = @'
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
'@
$projectModel | Set-Content -Path models\project.model.js -Encoding UTF8

# models/holiday.model.js
$holidayModel = @'
const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    name: { type: String, required: [true, 'Holiday name is required'], trim: true },
    date: { type: Date, required: [true, 'Holiday date is required'] }
}, { timestamps: true });

HolidaySchema.index({ date: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Holiday', HolidaySchema);
'@
$holidayModel | Set-Content -Path models\holiday.model.js -Encoding UTF8

# models/timesheet.model.js
$timesheetModel = @'
const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    type: { type: String, enum: ['check-in', 'check-out'], required: true },
    time: { type: String, required: true },
    location: { lat: Number, lon: Number, name: { type: String } },
    project: { type: String },
    description: { type: String }
});

const TimesheetSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    employeeName: { type: String, required: true, uppercase: true },
    date: { type: String, required: true },
    entries: [entrySchema],
    totalHours:   { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours:{ type: Number, default: 0 }
});

TimesheetSchema.index({ employeeName: 1, date: 1, kioskId: 1 }, { unique: true });
module.exports = mongoose.model('Timesheet', TimesheetSchema);
'@
$timesheetModel | Set-Content -Path models\timesheet.model.js -Encoding UTF8

# models/leave.model.js
$leaveModel = @'
const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
    kioskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kiosk', required: true },
    employeeName: { type: String, required: [true, 'Employee name is required'], uppercase: true },
    leaveType: { type: String, required: [true, 'Leave type is required'], trim: true },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['Approved', 'Pending', 'Rejected'], default: 'Approved' }
}, { timestamps: true });

module.exports = mongoose.model('Leave', LeaveSchema);
'@
$leaveModel | Set-Content -Path models\leave.model.js -Encoding UTF8

# middleware/auth.middleware.js
$authMiddleware = @'
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user || !req.user.kioskId) {
                res.status(401);
                throw new Error('User not found or not associated with a kiosk');
            }
            req.kioskId = req.user.kioskId;
            next();
        } catch (error) {
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

module.exports = { protect };
'@
$authMiddleware | Set-Content -Path middleware\auth.middleware.js -Encoding UTF8

# routes (examples)
$authRoutes = @'
const express = require('express');
const router = express.Router();
const { registerKiosk, loginUser, forgotPassword, resetPassword } = require('../controllers/auth.controller.js');
router.post('/register', registerKiosk);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
module.exports = router;
'@
$authRoutes | Set-Content -Path routes\auth.routes.js -Encoding UTF8

$kioskRoutes = @'
const express = require('express');
const router = express.Router();
const { validateKiosk } = require('../controllers/kiosk.controller.js');
router.get('/validate/:kioskId', validateKiosk);
module.exports = router;
'@
$kioskRoutes | Set-Content -Path routes\kiosk.routes.js -Encoding UTF8

$userRoutes = @'
const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile, getUsers, deleteUser, updateUser } = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.route('/').get(protect, getUsers);
router.route('/:id').delete(protect, deleteUser).put(protect, updateUser);
module.exports = router;
'@
$userRoutes | Set-Content -Path routes\user.routes.js -Encoding UTF8

$employeeRoutes = @'
const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, registerFace, setEmployeePin, deleteEmployee, getAllEmployeesForFaceLogin, verifyEmployeePin } = require('../controllers/employee.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.get('/face-login-data/:kioskId', getAllEmployeesForFaceLogin);
router.post('/verify-pin', verifyEmployeePin);
router.route('/').get(protect, getEmployees).post(protect, createEmployee);
router.route('/face').post(protect, registerFace);
router.route('/:id/set-pin').put(protect, setEmployeePin);
router.route('/:id').delete(protect, deleteEmployee);
module.exports = router;
'@
$employeeRoutes | Set-Content -Path routes\employee.routes.js -Encoding UTF8

$clientRoutes = @'
const express = require('express');
const router = express.Router();
const { getClients, createClient, deleteClient } = require('../controllers/client.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(protect, getClients).post(protect, createClient);
router.route('/:id').delete(protect, deleteClient);
module.exports = router;
'@
$clientRoutes | Set-Content -Path routes\client.routes.js -Encoding UTF8

$projectRoutes = @'
const express = require('express');
const router = express.Router();
const { getProjects, createProject, deleteProject } = require('../controllers/project.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(protect, getProjects).post(protect, createProject);
router.route('/:id').delete(protect, deleteProject);
module.exports = router;
'@
$projectRoutes | Set-Content -Path routes\project.routes.js -Encoding UTF8

$timesheetRoutes = @'
const express = require('express');
const router = express.Router();
const { getTimesheets, createOrUpdateEntry, updateTimesheet } = require('../controllers/timesheet.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getTimesheets);
router.route('/entry').post(createOrUpdateEntry);
router.route('/:id').put(protect, updateTimesheet);
module.exports = router;
'@
$timesheetRoutes | Set-Content -Path routes\timesheet.routes.js -Encoding UTF8

$holidayRoutes = @'
const express = require('express');
const router = express.Router();
const { getHolidays, createHoliday, deleteHoliday } = require('../controllers/holiday.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getHolidays).post(protect, createHoliday);
router.route('/:id').delete(protect, deleteHoliday);
module.exports = router;
'@
$holidayRoutes | Set-Content -Path routes\holiday.routes.js -Encoding UTF8

$leaveRoutes = @'
const express = require('express');
const router = express.Router();
const { getLeaveForEmployee, createLeave, deleteLeave } = require('../controllers/leave.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(getLeaveForEmployee).post(protect, createLeave);
router.route('/:id').delete(protect, deleteLeave);
module.exports = router;
'@
$leaveRoutes | Set-Content -Path routes\leave.routes.js -Encoding UTF8

# controllers/auth.controller.js (abbreviated, enough to be valid)
$authController = @'
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
'@
$authController | Set-Content -Path controllers\auth.controller.js -Encoding UTF8

# For brevity create simplified controllers used by routes. (You can expand later)
$kioskController = @'
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
'@
$kioskController | Set-Content -Path controllers\kiosk.controller.js -Encoding UTF8

# other controllers (you can expand as needed) - create simple placeholders to avoid require errors
$commonControllers = @'
const asyncHandler = require("express-async-handler");
module.exports = {
    getUserProfile: asyncHandler(async (req,res)=> res.json({message:"ok"})),
    updateUserProfile: asyncHandler(async (req,res)=> res.json({message:"ok"})),
    getUsers: asyncHandler(async (req,res)=> res.json([])),
    deleteUser: asyncHandler(async (req,res)=> res.json({message:"deleted"})),
    updateUser: asyncHandler(async (req,res)=> res.json({message:"updated"}))
};
'@
$commonControllers | Set-Content -Path controllers\user.controller.js -Encoding UTF8

$employeeController = @'
const asyncHandler = require('express-async-handler');
const Employee = require('../models/employee.model.js');
const Timesheet = require('../models/timesheet.model.js');

const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({ kioskId: req.kioskId });
    const employeesWithStatus = employees.map((emp) => ({ _id: emp._id, name: emp.name, hasFaceDescriptor: emp.faceDescriptor && emp.faceDescriptor.length > 0 }));
    res.json(employeesWithStatus);
});

const createEmployee = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const employeeExists = await Employee.findOne({ name: name.toUpperCase(), kioskId: req.kioskId });
    if (employeeExists) { res.status(400); throw new Error('Employee already exists in this kiosk'); }
    const employee = await Employee.create({ name: name.toUpperCase(), kioskId: req.kioskId });
    res.status(201).json({ _id: employee._id, name: employee.name, hasFaceDescriptor: false });
});

const registerFace = asyncHandler(async (req, res) => {
    const { employeeId, descriptor } = req.body;
    const employee = await Employee.findOne({ _id: employeeId, kioskId: req.kioskId });
    if (!employee) { res.status(404); throw new Error('Employee not found in your kiosk'); }
    employee.faceDescriptor = descriptor;
    await employee.save();
    res.json({ message: 'Faceprint registered successfully' });
});

const setEmployeePin = asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) { res.status(400); throw new Error('PIN must be 4 digits'); }
    const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (!employee) { res.status(404); throw new Error('Employee not found in your kiosk'); }
    employee.pin = pin;
    await employee.save();
    res.json({ message: 'PIN set successfully' });
});

const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (employee) {
        await Timesheet.deleteMany({ employeeName: employee.name, kioskId: req.kioskId });
        await employee.deleteOne();
        res.json({ message: 'Employee deleted successfully' });
    } else { res.status(404); throw new Error('Employee not found in your kiosk'); }
});

const getAllEmployeesForFaceLogin = asyncHandler(async (req, res) => {
    const { kioskId } = req.params;
    if (!kioskId) { res.status(400); throw new Error('Kiosk ID is required'); }
    const employees = await Employee.find({ kioskId: kioskId, faceDescriptor: { $exists: true, $ne: [] } }).select('name faceDescriptor');
    res.json(employees);
});

const verifyEmployeePin = asyncHandler(async (req, res) => {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) { res.status(400); throw new Error('Verification data is missing'); }
    const employee = await Employee.findById(employeeId);
    if (employee && (await employee.matchPin(pin))) {
        res.json({ _id: employee._id, name: employee.name, kioskId: employee.kioskId });
    } else { res.status(401); throw new Error('Incorrect PIN'); }
});

module.exports = { getEmployees, createEmployee, registerFace, setEmployeePin, deleteEmployee, getAllEmployeesForFaceLogin, verifyEmployeePin };
'@
$employeeController | Set-Content -Path controllers\employee.controller.js -Encoding UTF8

# simplified other controllers
$clientController = @'
const asyncHandler = require("express-async-handler");
const Client = require("../models/client.model.js");
const Project = require("../models/project.model.js");

const getClients = asyncHandler(async (req,res) => {
    const clients = await Client.find({ kioskId: req.kioskId });
    res.json(clients);
});

const createClient = asyncHandler(async (req,res) => {
    const { name, email, phone, address } = req.body;
    if (!name) { res.status(400); throw new Error("Client name is required"); }
    const clientExists = await Client.findOne({ name, kioskId: req.kioskId });
    if (clientExists) { res.status(400); throw new Error("Client already exists in this kiosk"); }
    const client = await Client.create({ name, email, phone, address, kioskId: req.kioskId });
    res.status(201).json(client);
});

const deleteClient = asyncHandler(async (req,res) => {
    const client = await Client.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (client) {
        await Project.deleteMany({ clientName: client.name, kioskId: req.kioskId });
        await client.deleteOne();
        res.json({ message: "Client and associated projects have been deleted" });
    } else { res.status(404); throw new Error("Client not found"); }
});

module.exports = { getClients, createClient, deleteClient };
'@
$clientController | Set-Content -Path controllers\client.controller.js -Encoding UTF8

$projectController = @'
const asyncHandler = require("express-async-handler");
const Project = require("../models/project.model.js");

const getProjects = asyncHandler(async (req,res) => {
    const projects = await Project.find({ kioskId: req.kioskId });
    res.json(projects);
});

const createProject = asyncHandler(async (req,res) => {
    const { name, clientName, rate } = req.body;
    if (!name || !clientName || !rate) { res.status(400); throw new Error("Please fill in all project fields"); }
    const projectExists = await Project.findOne({ name, kioskId: req.kioskId });
    if (projectExists) { res.status(400); throw new Error("Project already exists"); }
    const project = await Project.create({ name, clientName, rate, kioskId: req.kioskId });
    res.status(201).json(project);
});

const deleteProject = asyncHandler(async (req,res) => {
    const project = await Project.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (project) {
        await project.deleteOne();
        res.json({ message: "Project deleted successfully" });
    } else { res.status(404); throw new Error("Project not found"); }
});

module.exports = { getProjects, createProject, deleteProject };
'@
$projectController | Set-Content -Path controllers\project.controller.js -Encoding UTF8

$holidayController = @'
const asyncHandler = require("express-async-handler");
const Holiday = require("../models/holiday.model.js");

const getHolidays = asyncHandler(async (req,res) => {
    const { kioskId } = req.query;
    let query = {};
    if (kioskId) { query.kioskId = kioskId; }
    const holidays = await Holiday.find(query).sort({ date: "asc" });
    res.json(holidays);
});

const createHoliday = asyncHandler(async (req,res) => {
    const { name, date } = req.body;
    if (!name || !date) { res.status(400); throw new Error("Please enter name and date"); }
    const holiday = await Holiday.create({ name, date, kioskId: req.kioskId });
    res.status(201).json(holiday);
});

const deleteHoliday = asyncHandler(async (req,res) => {
    const holiday = await Holiday.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (holiday) { await holiday.deleteOne(); res.json({ message: "Holiday deleted successfully" }); } else { res.status(404); throw new Error("Holiday not found"); }
});

module.exports = { getHolidays, createHoliday, deleteHoliday };
'@
$holidayController | Set-Content -Path controllers\holiday.controller.js -Encoding UTF8

$leaveController = @'
const asyncHandler = require("express-async-handler");
const Leave = require("../models/leave.model.js");

const getLeaveForEmployee = asyncHandler(async (req,res) => {
    const { employeeName, kioskId } = req.query;
    let query = {};
    if (kioskId) {
        query.kioskId = kioskId;
    } else if (req.kioskId) {
        query.kioskId = req.kioskId;
    }
    if (employeeName) { query.employeeName = employeeName.toUpperCase(); }
    const leaveRecords = await Leave.find(query).sort({ startDate: 'asc' });
    res.json(leaveRecords);
});

const createLeave = asyncHandler(async (req,res) => {
    const { employeeName, leaveType, startDate, endDate, reason } = req.body;
    if (!employeeName || !leaveType || !startDate || !endDate) { res.status(400); throw new Error('Please provide all required fields'); }
    const leave = await Leave.create({ employeeName, leaveType, startDate, endDate, reason, kioskId: req.kioskId });
    res.status(201).json(leave);
});

const deleteLeave = asyncHandler(async (req,res) => {
    const leaveRecord = await Leave.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (leaveRecord) { await leaveRecord.deleteOne(); res.json({ message: 'Leave record removed successfully' }); } else { res.status(404); throw new Error('Leave record not found'); }
});

module.exports = { getLeaveForEmployee, createLeave, deleteLeave };
'@
$leaveController | Set-Content -Path controllers\leave.controller.js -Encoding UTF8

# timesheet.controller.js simplified (uses helpers)
$timesheetController = @'
const asyncHandler = require("express-async-handler");
const Timesheet = require("../models/timesheet.model.js");
const Employee = require("../models/employee.model.js");
const { calculateDayHours, toLocalMidnight, getLocationName } = require("../utils/timesheet.helpers.js");

const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate, kioskId } = req.query;
    const filter = {};
    if (kioskId) { filter.kioskId = kioskId; }
    if (employeeName) { filter.employeeName = employeeName.toUpperCase(); }
    if (startDate && endDate) { filter.date = { $gte: startDate, $lte: endDate }; }
    const records = await Timesheet.find(filter).sort({ date: "asc" });
    res.json(records);
});

const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { kioskId, employeeName, date, time, location, faceDescriptor, project, description } = req.body;
    if (!kioskId || !employeeName || !date || !time || !location) { res.status(400); throw new Error("Incomplete registration data"); }
    const employee = await Employee.findOne({ name: employeeName.toUpperCase(), kioskId: kioskId });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) { res.status(401); throw new Error("Faceprint not registered for this employee"); }
    // face verification is environment-specific; placeholder that skips actual face-api usage
    const locationName = await getLocationName(location.lat, location.lon);
    const locationWithName = { ...location, name: locationName };
    let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date, kioskId: kioskId });
    if (timesheet) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === "check-out" ? "check-in" : "check-out";
        timesheet.entries.push({ type: newEntryType, time, location: locationWithName, project, description });
    } else {
        timesheet = await Timesheet.create({ kioskId: kioskId, employeeName: employeeName.toUpperCase(), date, entries: [{ type: "check-in", time, location: locationWithName, project, description }], });
    }
    const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(date));
    timesheet.totalHours = total;
    timesheet.regularHours = regular;
    timesheet.overtimeHours = overtime;
    const updatedTimesheet = await timesheet.save();
    res.json(updatedTimesheet);
});

const updateTimesheet = asyncHandler(async (req,res) => {
    const timesheet = await Timesheet.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (timesheet) {
        timesheet.entries = req.body.entries || timesheet.entries;
        const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(timesheet.date));
        timesheet.totalHours = total;
        timesheet.regularHours = regular;
        timesheet.overtimeHours = overtime;
        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else { res.status(404); throw new Error('Timesheet record not found'); }
});

module.exports = { getTimesheets, createOrUpdateEntry, updateTimesheet };
'@
$timesheetController | Set-Content -Path controllers\timesheet.controller.js -Encoding UTF8

# services/email.service.js (minimal)
$emailService = @'
const nodemailer = require("nodemailer");
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 2525,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

module.exports = async function sendEmail({ to, subject, html }) {
    return transporter.sendMail({ from: EMAIL_FROM || "no-reply@localhost", to, subject, html });
};
'@
$emailService | Set-Content -Path services\email.service.js -Encoding UTF8

# utils/generateToken.js
$genToken = @'
const jwt = require("jsonwebtoken");
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });
module.exports = generateToken;
'@
$genToken | Set-Content -Path utils\generateToken.js -Encoding UTF8

# server.js (basic)
$serverJs = @'
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lavoro", { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => res.send("Lavoro Track API"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
'@
$serverJs | Set-Content -Path server.js -Encoding UTF8

Write-Host "[+] Files created. You can now run:"

Write-Host "  1) In PowerShell: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force"
Write-Host "  2) npm init -y"
Write-Host "  3) npm install express mongoose bcryptjs jsonwebtoken express-async-handler dotenv nodemailer node-fetch"
Write-Host "  4) node server.js"
Write-Host ""
Write-Host "Notes:"
Write-Host "- If you plan to use face-api on Node, that needs extra native deps (tfjs-node, canvas) and setup."
Write-Host "- Replace placeholders in .env (MONGO_URI, JWT_SECRET, MAILTRAP credentials)."
