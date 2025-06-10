const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email configuration from environment variables with fallbacks
const config = {
    email: process.env.ALERT_EMAIL || "hh4745525@gmail.com",
    password: process.env.ALERT_PASSWORD || "zkgk hjpt jmsf bzsz",
    receiver: process.env.RECEIVER_EMAIL || "ramaharsha804@gmail.com"
};

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: config.email,
        pass: config.password
    },
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production'
});

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs/emails');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Email templates
const templates = {
    'Products/Services Request': {
        subject: 'Request for Products/Services Information',
        template: (data) => `
            <h2>Products/Services Information Request</h2>
            <p>A user has requested information about your products and services.</p>
            <p><strong>Name:</strong> ${data.userName || 'Not provided'}</p>
            <p><strong>Email:</strong> ${data.userEmail || 'Not provided'}</p>
            <p><strong>Mobile:</strong> ${data.mobile || 'Not provided'}</p>
            <p><strong>Message:</strong> ${data.query}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
    },
    'Pricing Request': {
        subject: 'Request for Pricing Information',
        template: (data) => `
            <h2>Pricing Information Request</h2>
            <p>A user has requested pricing information.</p>
            <p><strong>Name:</strong> ${data.userName || 'Not provided'}</p>
            <p><strong>Email:</strong> ${data.userEmail || 'Not provided'}</p>
            <p><strong>Mobile:</strong> ${data.mobile || 'Not provided'}</p>
            <p><strong>Message:</strong> ${data.query}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
    },
    'Appointment Request': {
        subject: 'New Appointment Request Received',
        template: (data) => `
            <h2>New Appointment Request</h2>
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
                <div style="background: white; padding: 20px; border-radius: 4px;">
                    <p><strong>Name:</strong> ${data.userName || 'Not provided'}</p>
                    <p><strong>Email:</strong> ${data.userEmail || 'Not provided'}</p>
                    <p><strong>Mobile:</strong> ${data.mobile || 'Not provided'}</p>
                    <p><strong>Appointment Purpose:</strong> ${data.query}</p>
                </div>
            </div>
        `
    },
    'default': {
        subject: (category) => `Alert: ${category} Query Received`,
        template: (data) => `
            <h2>Sensitive Query Alert</h2>
            <p><strong>Category:</strong> ${data.category}</p>
            <p><strong>Query:</strong> ${data.query}</p>
            <p><strong>User:</strong> ${data.userName || 'Not provided'}</p>
            <p><strong>Email:</strong> ${data.userEmail || 'Not provided'}</p>
            <p><strong>Mobile:</strong> ${data.mobile || 'Not provided'}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
    }
};

/**
 * Log email to file as fallback
 */
async function logEmailToFile(mailOptions, category) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(logDir, `${timestamp}_${category.replace(/\s+/g, '_')}.json`);
        
        const logData = {
            timestamp: new Date().toISOString(),
            category,
            mailOptions: {
                ...mailOptions,
                html: mailOptions.html ? 'HTML content' : undefined
            },
            error: 'Email sending failed, saved as fallback'
        };
        
        fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
        console.log(`Email details logged to file: ${logFile}`);
        return true;
    } catch (error) {
        console.error('Error logging email to file:', error);
        return false;
    }
}

/**
 * Send alert email
 */
async function sendAlertEmail(query, category, userName = '', userEmail = '', mobile = '') {
    const template = templates[category] || templates['default'];
    const isDefault = !templates[category];
    
    const templateData = { 
        query, 
        category: isDefault ? category : undefined,
        userName, 
        userEmail, 
        mobile 
    };

    const mailOptions = {
        from: `"Chat Support" <${config.email}>`,
        to: config.receiver,
        subject: isDefault ? template.subject(category) : template.subject,
        html: template.template(templateData)
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending failed:', error);
        
        // Log to file as fallback
        await logEmailToFile(mailOptions, category);
        
        return { 
            success: false, 
            error: 'Failed to send email',
            details: error.message
        };
    }
}

module.exports = {
    sendAlertEmail
};
