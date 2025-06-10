const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'hh4745525@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'zkgk hjpt jmsf bzsz'
    }
});

// Email templates
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

// Send appointment emails function
const sendAppointmentEmails = async (appointment) => {
    try {
        // Send confirmation to customer
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL || 'hh4745525@gmail.com',
            to: appointment.email,
            subject: 'Appointment Confirmation',
            html: getCustomerEmailTemplate(appointment)
        });

        // Send notification to company
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL || 'hh4745525@gmail.com',
            to: process.env.RECEIVER_EMAIL || 'ramaharsha804@gmail.com',
            subject: `New Appointment: ${appointment.name}`,
            html: getCompanyEmailTemplate(appointment)
        });

        return true;
    } catch (error) {
        console.error('Error sending appointment emails:', error);
        return false;
    }
};

// Send alert email function
const sendAlertEmail = (userQuery, category, userName = '', userEmail = '') => {
    const subject = `Reminder: Query Related to ${category}`;
    const text = `
User Query: ${userQuery}
Category: ${category}
User Name: ${userName}
User Email: ${userEmail}`;

    const mailOptions = {
        from: process.env.ALERT_EMAIL || 'hh4745525@gmail.com',
        to: process.env.RECEIVER_EMAIL || 'ramaharsha804@gmail.com',
        subject: subject,
        text: text
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    transporter,
    sendAppointmentEmails,
    sendAlertEmail
};
