const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { sendAppointmentEmails } = require('../utils/emailService');

// Validate appointment data
const validateAppointment = (data) => {
    const errors = [];
    if (!data.name) errors.push('Name is required');
    if (!data.email) errors.push('Email is required');
    if (!data.mobile) errors.push('Mobile number is required');
    if (!data.appointmentDate) errors.push('Appointment date is required');
    if (!data.appointmentTime) errors.push('Appointment time is required');
    if (!data.purpose) errors.push('Purpose is required');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
        errors.push('Invalid email format');
    }

    // Validate mobile number
    const mobileRegex = /^[0-9]{10,15}$/;
    if (data.mobile && !mobileRegex.test(data.mobile)) {
        errors.push('Invalid mobile number format (should be 10-15 digits)');
    }

    return errors;
};

// Create new appointment
router.post('/', async (req, res) => {
    try {
        console.log('----------------------------------------');
        console.log('Received appointment request');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        // Check if body is empty
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('Error: Empty request body');
            return res.status(400).json({
                success: false,
                message: 'Request body is empty',
                errors: ['No appointment data provided']
            });
        }
        
        // Validate request data
        const validationErrors = validateAppointment(req.body);
        if (validationErrors.length > 0) {
            console.log('Validation errors:', validationErrors);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const { name, email, mobile, appointmentDate, appointmentTime, purpose } = req.body;

        // Parse and validate date
        let parsedDate;
        try {
            parsedDate = new Date(appointmentDate);
            if (isNaN(parsedDate.getTime())) {
                throw new Error('Invalid date format');
            }
        } catch (error) {
            console.log('Date parsing error:', error);
            return res.status(400).json({
                success: false,
                message: 'Invalid date format',
                errors: ['appointmentDate must be a valid date']
            });
        }

        const appointment = new Appointment({
            name,
            email,
            mobile,
            appointmentDate: parsedDate,
            appointmentTime,
            purpose,
            status: 'pending'
        });

        console.log('Creating appointment:', appointment);

        // Save appointment to database
        const savedAppointment = await appointment.save();
        console.log('Appointment saved:', savedAppointment);

        // Send confirmation emails
        try {
            const emailsSent = await sendAppointmentEmails(savedAppointment);
            console.log('Emails sent:', emailsSent);

            res.status(201).json({ 
                success: true, 
                message: 'Appointment booked successfully. Confirmation emails sent.',
                appointment: savedAppointment
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Still return success since appointment was saved
            res.status(201).json({ 
                success: true, 
                message: 'Appointment booked successfully, but there was an error sending confirmation emails.',
                appointment: savedAppointment
            });
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        console.error('Error stack:', error.stack);
        
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }

        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate appointment',
                errors: ['An appointment with this date and time already exists']
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating appointment',
            errors: [error.message]
        });
    }
});

// Get all appointments
router.get('/', async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .sort({ appointmentDate: 1, appointmentTime: 1 });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching appointments',
            error: error.message 
        });
    }
});

// Update appointment status
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!appointment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Appointment not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Appointment updated successfully',
            appointment 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error updating appointment',
            error: error.message 
        });
    }
});

module.exports = router;
