// -----------------------------------------------------------------------------
// ملف نموذج المستخدم (models/user.model.js)
// -----------------------------------------------------------------------------
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    }
});

// قبل حفظ المستخدم في قاعدة البيانات، نقوم بتشفير كلمة المرور
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// دالة لمقارنة كلمة المرور المدخلة بالكلمة المشفرة في قاعدة البيانات
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;
