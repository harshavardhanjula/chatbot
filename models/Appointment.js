const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
        match: [/^[0-9]{10,15}$/, 'Please enter a valid mobile number (10-15 digits)']
    },
    appointmentDate: {
        type: Date,
        required: [true, 'Appointment date is required'],
        validate: {
            validator: function(v) {
                return v && v.getTime() >= new Date().setHours(0, 0, 0, 0);
            },
            message: 'Appointment date must be today or in the future'
        }
    },
    appointmentTime: {
        type: String,
        required: [true, 'Appointment time is required'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
    },
    purpose: {
        type: String,
        required: [true, 'Purpose is required'],
        trim: true,
        minlength: [3, 'Purpose must be at least 3 characters long']
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'confirmed', 'cancelled', 'completed'],
            message: '{VALUE} is not a valid status'
        },
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a compound index for appointmentDate and appointmentTime to prevent duplicates
appointmentSchema.index({ appointmentDate: 1, appointmentTime: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
