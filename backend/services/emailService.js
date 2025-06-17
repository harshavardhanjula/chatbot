const nodemailer = require('nodemailer');
require('dotenv').config();

// Debug logging
console.log('Initializing email service...');
console.log('Environment variables:', {
    ALERT_EMAIL: process.env.ALERT_EMAIL ? '***' : 'Not set',
    EMAIL_USER: process.env.EMAIL_USER ? '***' : 'Not set',
    RECEIVER_EMAIL: process.env.RECEIVER_EMAIL ? '***' : 'Not set',
    NODE_ENV: process.env.NODE_ENV || 'development'
});

// Email configuration
const config = {
    email: process.env.ALERT_EMAIL || process.env.EMAIL_USER,
    password: process.env.ALERT_PASSWORD || process.env.EMAIL_PASSWORD,
    receiver: process.env.RECEIVER_EMAIL
};

// Validate configuration
if (!config.email || !config.password) {
    console.error('❌ Email configuration error: Missing required email credentials');
    throw new Error('Email service configuration is incomplete');
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: config.email,
        pass: config.password
    },
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production'
});

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('❌ SMTP connection error:', error);
    } else {
        console.log('✅ SMTP server is ready to take our messages');
    }
});

// Email templates
const templates = {
    'default': {
        subject: (category) => `Alert: ${category}`,
        template: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${data.category || 'New Notification'}</h2>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <p><strong>Query:</strong> ${data.query || 'No query provided'}</p>
                    <p><strong>User:</strong> ${data.userName || 'Guest User'}</p>
                    <p><strong>Email:</strong> ${data.userEmail || 'No email provided'}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `
    }
};

/**
 * Send an email using the specified template
 */
async function sendEmail(templateName, data = {}) {
    console.log('\n=== Sending Email ===');
    console.log('Template:', templateName);
    console.log('Recipient:', data.recipient || config.receiver);
    console.log('Data:', JSON.stringify(data, null, 2));

    const template = templates[templateName] || templates['default'];
    const isDefault = !templates[templateName];
    
    const templateData = {
        ...data,
        category: isDefault ? templateName : undefined
    };

    const emailSubject = isDefault ? 
        (typeof template.subject === 'function' ? template.subject(templateName) : templateName) :
        (typeof template.subject === 'function' ? template.subject() : template.subject);

    const mailOptions = {
        from: `"Support Team" <${config.email}>`,
        to: data.recipient || config.receiver,
        subject: emailSubject,
        html: template.template(templateData),
        // Add text version for email clients that don't support HTML
        text: `
            ${data.category || 'Notification'}
            =====================
            
            Query: ${data.query || 'No query provided'}
            User: ${data.userName || 'Guest User'}
            Email: ${data.userEmail || 'No email provided'}
            Time: ${new Date().toLocaleString()}
        `
    };

    try {
        console.log('Sending email with options:', {
            to: mailOptions.to,
            subject: mailOptions.subject
        });
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        
        return { 
            success: true, 
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        };
        
    } catch (error) {
        console.error('❌ Email sending failed:', {
            error: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            stack: error.stack
        });
        
        return { 
            success: false, 
            error: 'Failed to send email',
            details: error.message,
            code: error.code
        };
    }
}

module.exports = {
    sendEmail
};
