const express = require('express');
const router = express.Router();
const { sendAppointmentEmails } = require('../config/email');
const Appointment = require('../models/Appointment');

// Create new appointment
router.post('/', async (req, res) => {
    try {
        console.log('Received appointment request:', req.body);
        const { name, email, mobile, appointmentDate, appointmentTime, purpose } = req.body;
        
        // Create new appointment
        const appointment = new Appointment({
            name,
            email,
            mobile,
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            purpose,
            status: 'pending'
        });

        console.log('Creating appointment:', appointment);

        // Save appointment
        const savedAppointment = await appointment.save();
        console.log('Appointment saved:', savedAppointment);

        // Send confirmation emails
        try {
            const emailsSent = await sendAppointmentEmails(savedAppointment);
            console.log('Emails sent:', emailsSent);

            res.status(201).json({
                success: true,
                message: emailsSent 
                    ? 'Appointment booked successfully. Confirmation emails sent.'
                    : 'Appointment booked successfully, but there was an error sending confirmation emails.',
                appointment: savedAppointment
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully, but there was an error sending confirmation emails.',
                appointment: savedAppointment
            });
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        console.error('Error stack:', error.stack);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }

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
        const appointments = await Appointment.find().sort({ appointmentDate: 1, appointmentTime: 1 });
        res.json({
            success: true,
            appointments
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments',
            error: error.message
        });
    }
});

module.exports = router;
