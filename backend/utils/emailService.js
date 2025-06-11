const nodemailer = require('nodemailer');
require('dotenv').config();

const {
    EMAIL_USER,
    EMAIL_PASSWORD,
    RECEIVER_EMAIL,
    ALERT_EMAIL
} = process.env;

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
    }
});

// Email template for customer
const getCustomerEmailTemplate = (appointment) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Appointment Confirmation</h2>
        <p>Dear ${appointment.name},</p>
        <p>Your appointment has been successfully booked. Here are the details:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Purpose:</strong> ${appointment.purpose}</p>
        </div>
        <p>We will contact you shortly to confirm your appointment.</p>
        <p>Best regards,<br>Support Team</p>
    </div>
`;

// Email template for company
const getCompanyEmailTemplate = (appointment) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Appointment Booking</h2>
        <p>A new appointment has been booked. Here are the details:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            <p><strong>Name:</strong> ${appointment.name}</p>
            <p><strong>Email:</strong> ${appointment.email}</p>
            <p><strong>Mobile:</strong> ${appointment.mobile}</p>
            <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Purpose:</strong> ${appointment.purpose}</p>
        </div>
    </div>
`;

// Send appointment confirmation emails
const sendAppointmentEmails = async (appointment) => {
    try {
        // Send confirmation to customer
        await transporter.sendMail({
            from: ALERT_EMAIL,
            to: appointment.email,
            subject: 'Appointment Confirmation',
            html: getCustomerEmailTemplate(appointment)
        });

        // Send notification to company
        await transporter.sendMail({
            from: ALERT_EMAIL,
            to: RECEIVER_EMAIL,
            subject: `New Appointment: ${appointment.name}`,
            html: getCompanyEmailTemplate(appointment)
        });

        return true;
    } catch (error) {
        console.error('Error sending appointment emails:', error);
        return false;
    }
};

module.exports = {
    sendAppointmentEmails
};
