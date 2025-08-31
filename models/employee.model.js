const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
    },
    faceDescriptor: {
        type: [Number],
    },
    pin: {
        type: String,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual property to check if face descriptor exists
employeeSchema.virtual('hasFaceDescriptor').get(function() {
    return this.faceDescriptor && this.faceDescriptor.length > 0;
});

// Virtual property to check if PIN exists
employeeSchema.virtual('hasPin').get(function() {
    return !!this.pin;
});

// Hash PIN before saving
employeeSchema.pre('save', async function(next) {
    if (!this.isModified('pin')) {
        next();
    }
    if(this.pin) {
        const salt = await bcrypt.genSalt(10);
        this.pin = await bcrypt.hash(this.pin, salt);
    }
});

// Method to compare entered PIN with hashed PIN
employeeSchema.methods.matchPin = async function(enteredPin) {
    if(!this.pin) return false;
    return await bcrypt.compare(enteredPin, this.pin);
};


const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
