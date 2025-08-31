const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم الموظف مطلوب'],
        unique: true,
        uppercase: true,
        trim: true,
    },
    faceDescriptor: {
        type: [Number],
    },
    pin: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// تشفير رمز PIN تلقائيًا قبل الحفظ
employeeSchema.pre('save', async function (next) {
    if (!this.isModified('pin')) {
        next();
    }
    if (this.pin) {
        const salt = await bcrypt.genSalt(10);
        this.pin = await bcrypt.hash(this.pin, salt);
    }
});

// دالة لمقارنة رمز PIN المدخل بالرمز المشفر
employeeSchema.methods.matchPin = async function (enteredPin) {
    if (!this.pin) return false;
    return await bcrypt.compare(enteredPin, this.pin);
};

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;

