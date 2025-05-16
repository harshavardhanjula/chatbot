const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Email addresses for notifications
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;
const ALERT_EMAIL = process.env.ALERT_EMAIL;

// Email templates
const getCustomerEmailTemplate = (appointment) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Appointment Confirmation</h2>
        <p>Dear ${appointment.name},</p>
        <p>Your appointment has been successfully booked with Angadi World Technologies.</p>
        <h3>Appointment Details:</h3>
        <ul>
            <li>Date: ${new Date(appointment.appointmentDate).toLocaleDateString()}</li>
            <li>Time: ${appointment.appointmentTime}</li>
            <li>Purpose: ${appointment.purpose}</li>
        </ul>
        <p>If you need to reschedule or cancel your appointment, please contact us at ${RECEIVER_EMAIL}</p>
        <p>Best regards,<br>Angadi World Technologies Team</p>
    </div>
    `;
};

const getCompanyEmailTemplate = (appointment) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Appointment Booking</h2>
        <h3>Customer Details:</h3>
        <ul>
            <li>Name: ${appointment.name}</li>
            <li>Email: ${appointment.email}</li>
            <li>Mobile: ${appointment.mobile}</li>
        </ul>
        <h3>Appointment Details:</h3>
        <ul>
            <li>Date: ${new Date(appointment.appointmentDate).toLocaleDateString()}</li>
            <li>Time: ${appointment.appointmentTime}</li>
            <li>Purpose: ${appointment.purpose}</li>
        </ul>
    </div>
    `;
};

const sendAppointmentEmails = async (appointment) => {
    try {
        // Send confirmation email to customer
        await transporter.sendMail({
            from: ALERT_EMAIL,
            to: appointment.email,
            subject: 'Appointment Confirmation - Angadi World Technologies',
            html: getCustomerEmailTemplate(appointment)
        });

        // Send notification to company
        await transporter.sendMail({
            from: ALERT_EMAIL,
            to: RECEIVER_EMAIL,
            subject: `New Appointment: ${appointment.name} - ${new Date(appointment.appointmentDate).toLocaleDateString()}`,
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
