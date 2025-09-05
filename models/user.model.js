const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'الرجاء إدخال الاسم'],
    },
    email: {
        type: String,
        required: [true, 'الرجاء إدخال البريد الإلكتروني'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'الرجاء إدخال بريد إلكتروني صالح',
        ],
    },
    // -- التعديل الأساسي --
    // جعل اسم المستخدم حقلاً إجباريًا وفريدًا لمنع قيمة null
    username: {
        type: String,
        required: [true, 'اسم المستخدم مطلوب'],
        unique: true,
    },
    password: {
        type: String,
        required: [true, 'الرجاء إدخال كلمة المرور'],
        minlength: 6,
        select: false, // لن يتم إرجاع كلمة المرور عند الاستعلام عن المستخدمين
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// دالة لمقارنة كلمة المرور المدخلة بالكلمة المشفرة في قاعدة البيانات
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
