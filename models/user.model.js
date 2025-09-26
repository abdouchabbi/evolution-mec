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
