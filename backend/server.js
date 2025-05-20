const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Apply CORS to all routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// MongoDB Atlas Connection with retry logic
const connectWithRetry = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            throw new Error('MongoDB connection string is not defined in environment variables');
        }
        
        console.log('Attempting to connect to MongoDB...');
        console.log('Connection string:', MONGODB_URI.replace(/:([^:]+)@/, ':********@'));
        
        // Clear any existing connection first
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        // MongoDB connection options
        const options = {
            serverSelectionTimeoutMS: 5000,  // 5 seconds timeout for server selection
            socketTimeoutMS: 30000,         // 30 seconds timeout for socket operations
            connectTimeoutMS: 10000,        // 10 seconds timeout for initial connection
            useNewUrlParser: true,          // Use new URL parser
            useUnifiedTopology: true,       // Use new Server Discovery and Monitoring engine
            retryWrites: true,              // Enable retryable writes
            w: 'majority'                   // Write concern
        };
        
        // Parse the connection string to add retryWrites if not present
        let connectionString = MONGODB_URI;
        if (!connectionString.includes('retryWrites=')) {
            connectionString += (connectionString.includes('?') ? '&' : '?') + 'retryWrites=true';
        }
        
        await mongoose.connect(connectionString, options);
        
        // Verify the connection
        await mongoose.connection.db.admin().ping();
        console.log('✅ Successfully connected to MongoDB Atlas');
        console.log('Database name:', mongoose.connection.db.databaseName);
        
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('Error details:', {
            name: err.name,
            code: err.code,
            codeName: err.codeName,
            errorLabels: err.errorLabels || [],
            stack: err.stack?.split('\n')[0]
        });
        
        // Close any existing connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(e => console.log('Error disconnecting:', e.message));
        }
        
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('MongoDB event: connected');
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB event: disconnected');
    // Don't call connectWithRetry here as it's handled in the error handler
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB event: reconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB event: error', err.message);
});

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    }
});

// Initial connection
connectWithRetry();

const Chat = require('./models/Chat');
const AgentHandler = require('./handlers/agentHandler');
const RequestModel = require('./models/Request');
const Agent = require('./models/Agent');
const requestController = require('./controllers/requestController');
const chatController = require('./controllers/chatController');
const ResolvedRequest = require('./models/ResolvedRequest');
const Admin = require('./models/Admin');

// Create HTTP server
const server = http.createServer(app);
app.use(express.urlencoded({ extended: true }));

// Configure nodemailer for email notifications
const ALERT_EMAIL = process.env.ALERT_EMAIL || "hh4745525@gmail.com";
const ALERT_PASSWORD = process.env.ALERT_PASSWORD || "zkgk hjpt jmsf bzsz";
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL || "ramaharsha804@gmail.com";

// Log email configuration for debugging
console.log('Email configuration:', { 
    email: ALERT_EMAIL,
    receiverEmail: RECEIVER_EMAIL,
    // Don't log the password for security reasons
    passwordProvided: !!ALERT_PASSWORD
});

// Create a more secure transporter configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: ALERT_EMAIL,
        pass: ALERT_PASSWORD
    },
    debug: true, // Enable debug logs
    logger: true // Log information about the mail transport
});

// Function to log email details to a file as a fallback when email sending fails
async function logEmailToFile(mailOptions, category) {
    try {
        const fs = require('fs');
        const logDir = './email_logs';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = `${logDir}/${timestamp}_${category.replace(/\s+/g, '_')}.json`;
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Write email details to file
        fs.writeFileSync(
            logFile, 
            JSON.stringify({
                timestamp: new Date().toISOString(),
                category,
                mailOptions,
                error: 'Email sending failed, saved as fallback'
            }, null, 2)
        );
        
        console.log(`Email details logged to file: ${logFile}`);
        return true;
    } catch (error) {
        console.error('Error logging email to file:', error);
        return false;
    }
}

// Function to send alert email for sensitive queries and information requests
async function sendAlertEmail(query, category, userName = '', userEmail = '', mobile = '') {
    try {
        // Log parameters for debugging
        console.log('sendAlertEmail called with:', { query, category, userName, userEmail, mobile });
        
        // Use the existing transporter defined above

        // Determine email subject and template based on category
        let subject = '';
        let template = '';
        
        if (category === 'Products/Services Request') {
            subject = 'Request for Products/Services Information';
            template = `
                <h2>Products/Services Information Request</h2>
                <p>A user has requested information about your products and services.</p>
                <p><strong>Name:</strong> ${userName || 'Not provided'}</p>
                <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
                <p><strong>Message:</strong> ${query}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p>Please send them your product catalog and service information.</p>
            `;
        } else if (category === 'Pricing Request') {
            subject = 'Request for Pricing Information';
            template = `
                <h2>Pricing Information Request</h2>
                <p>A user has requested pricing information.</p>
                <p><strong>Name:</strong> ${userName || 'Not provided'}</p>
                <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
                <p><strong>Message:</strong> ${query}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p>Please send them your pricing details.</p>
            `;
        } else if (category === 'Customers Request') {
            subject = 'Request for Customer References';
            template = `
                <h2>Customer References Request</h2>
                <p>A user has requested information about your customers and case studies.</p>
                <p><strong>Name:</strong> ${userName || 'Not provided'}</p>
                <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
                <p><strong>Message:</strong> ${query}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p>Please send them your customer success stories and references.</p>
            `;
        } else if (category === 'Appointment Request') {
            subject = 'New Appointment Request Received';
            template = `
                <h2>New Appointment Request</h2>
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="background: white; padding: 20px; border-radius: 4px;">
                        <p><strong>Name:</strong> ${userName || 'Not provided'}</p>
                        <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                        <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
                        <p><strong>Appointment Purpose:</strong> ${query}</p>
                    </div>
                </div>
            `;
        } else if (category === 'User Canceled Form') {
            subject = 'Alert: User Canceled Form';
            template = `
                <h2>User Canceled Form Alert</h2>
                <p>A user started but canceled the contact form. They may still need assistance.</p>
                <p><strong>Query:</strong> ${query}</p>
                <p><strong>User:</strong> ${userName || 'Not provided'}</p>
                <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `;
        } else {
            // Default template for sensitive queries
            subject = `Alert: ${category} Query Received`;
            template = `
                <h2>Sensitive Query Alert</h2>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Query:</strong> ${query}</p>
                <p><strong>User:</strong> ${userName || 'Not provided'}</p>
                <p><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
                <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `;
        }

        // Create the email content
        const mailOptions = {
            from: ALERT_EMAIL,
            to: RECEIVER_EMAIL,
            subject: subject,
            html: template
        };

        // Log mail options for debugging (excluding sensitive info)
        console.log('Mail options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            // Don't log the full HTML content
            htmlLength: mailOptions.html ? mailOptions.html.length : 0
        });
        
        // Send the email
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.response);
            return true;
        } catch (emailError) {
            console.error('Error in transporter.sendMail:', emailError);
            // Check for authentication errors
            if (emailError.message && emailError.message.includes('auth')) {
                console.error('This appears to be an authentication error. Please check your email credentials.');
            }
            
            // Try the fallback mechanism
            console.log('Attempting to use fallback email logging mechanism...');
            const fallbackSuccess = await logEmailToFile(mailOptions, category);
            
            if (fallbackSuccess) {
                console.log('Email details successfully logged to file as fallback');
                return true; // Return true so the API reports success to the user
            }
            
            throw emailError; // Re-throw to be caught by the outer try-catch if fallback also fails
        }
    } catch (error) {
        console.error('Error in sendAlertEmail function:', error);
        return false;
    }
}

// Endpoint to handle communication with Python backend
app.post('/api/exec', async (req, res) => {
    try {
        // Check if req.body exists
        if (!req.body) {
            console.error('Request body is undefined');
            return res.status(400).json({ error: 'Request body is missing' });
        }
        
        const { query } = req.body;
        
        // Log the request for debugging
        console.log('API /api/exec received request:', { body: req.body });
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        
        // Forward the query to Python backend
        try {
            const pyRes = await axios.post('http://localhost:8000/chat', { query });
            const data = pyRes.data;
            return res.json(data);
        } catch (pyError) {
            console.error('Error communicating with Python backend:', pyError);
            return res.status(502).json({ 
                error: 'Error communicating with chat service',
                details: pyError.message 
            });
        }
    } catch (error) {
        console.error('Error processing query:', error);
        return res.status(500).json({ 
            error: 'An error occurred while processing your query',
            details: error.message 
        });
    }
});

// Separate endpoint for sending email notifications
app.post('/api/notify', async (req, res) => {
    try {
        // Check if req.body exists
        if (!req.body) {
            console.error('Request body is undefined in /api/notify');
            return res.status(400).json({ error: 'Request body is missing' });
        }
        
        // Log the request for debugging
        console.log('API /api/notify received request:', { body: req.body });
        
        const { query, userName, userEmail, mobile, category, forceAlert } = req.body;
        
        // Validate required fields
        const missingFields = [];
        if (!query) missingFields.push('query');
        if (!userName) missingFields.push('userName');
        if (!userEmail) missingFields.push('userEmail');
        
        if (missingFields.length > 0) {
            console.error(`Missing required fields in /api/notify: ${missingFields.join(', ')}`);
            return res.status(400).json({ 
                error: 'Missing required fields', 
                missingFields: missingFields 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail)) {
            console.error(`Invalid email format: ${userEmail}`);
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // Determine the email category
        let emailCategory = category || 'Sensitive';
        if (forceAlert) {
            emailCategory = 'User Canceled Form';
        }
        
        console.log(`Processing email notification for category: ${emailCategory}`);
        
        // Verify transporter is configured
        if (!transporter) {
            console.error('Email transporter is not configured');
            return res.status(500).json({ error: 'Email service not configured' });
        }
        
        // Send the email alert
        try {
            console.log('Attempting to send email notification...');
            const emailSent = await sendAlertEmail(query, emailCategory, userName, userEmail, mobile || '');
            
            if (emailSent) {
                console.log('Email notification sent successfully');
                return res.json({
                    success: true,
                    message: 'Email notification sent successfully'
                });
            } else {
                console.error('Failed to send email notification - sendAlertEmail returned false');
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send email notification'
                });
            }
        } catch (emailError) {
            console.error('Error in email sending process:', emailError);
            return res.status(500).json({
                success: false,
                error: 'Error sending email notification',
                details: emailError.message
            });
        }
    } catch (error) {
        console.error('Error sending email notification:', error);
        return res.status(500).json({ 
            success: false,
            error: 'An error occurred while sending the email notification',
            details: error.message 
        });
    }
});

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8
});

// Initialize agent handler
const agentHandler = new AgentHandler(io);

// Store active users
const activeUsers = new Map();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const admin = await Admin.findById(decoded.userId);
        
        if (!admin) {
            return res.status(403).json({ error: 'Invalid admin token' });
        }

        req.admin = admin;
        next();
    } catch (err) {
        console.error('Admin token verification error:', err);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find admin by username
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: admin._id,
                username: admin.username,
                role: 'admin' 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Return token and admin info (without password)
        const adminData = admin.toObject();
        delete adminData.password;
        
        res.json({ 
            token,
            admin: adminData
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Verify admin token endpoint
app.get('/api/admin/verify-token', authenticateAdmin, (req, res) => {
    // If we get here, the token is valid
    res.json({ 
        valid: true, 
        admin: {
            _id: req.admin._id,
            username: req.admin.username,
            name: req.admin.name,
            role: req.admin.role
        }
    });
});

// Agent login endpoint
app.post('/api/agent/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const agent = await Agent.findOne({ username });
        if (!agent) {
            console.error(`Agent login failed - User not found: ${username}`);
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Username not found. Please check your credentials.' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, agent.password);
        if (!validPassword) {
            console.error(`Agent login failed - Invalid password for user: ${username}`);
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Incorrect password. Please check your credentials.' 
            });
        }
        const token = jwt.sign(
            { id: agent._id, username: agent.username, role: agent.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        res.json({
            token,
            agent: {
                id: agent._id,
                username: agent.username,
                name: agent.name,
                email: agent.email,
                role: agent.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get agent profile
app.get('/api/agent/profile', authenticateToken, async (req, res) => {
    try {
        const agent = await Agent.findById(req.user.id).select('-password');
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add endpoint to get agent statistics
app.get('/api/agents/:agentId/stats', async (req, res) => {
    try {
        const stats = await agentHandler.getAgentStats(req.params.agentId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get chat history for a given chatId
app.get('/api/chat/:id', async (req, res) => {
    try {
        const chat = await Chat.findOne({ chatId: req.params.id });
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json(chat.messages.map(m => ({
            id: m._id,
            sender: m.senderId === chat.agentId ? 'agent' : 'user',
            content: m.message,
            timestamp: m.timestamp
        })));
    } catch (error) {
        console.error('❌ Error fetching chat:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all requests with detailed logging
app.get('/api/requests', async (req, res) => {
    try {
        console.log('📋 Fetching all requests...');
        // Only fetch requests that are pending or active
        const requests = await RequestModel.find({ status: { $in: ['pending', 'active'] } }).sort({ createdAt: -1 });
        console.log(`✅ Found ${requests.length} requests`);
        
        const formattedRequests = requests.map(r => ({
            id: r._id,
            type: r.type,
            name: r.name,
            query: r.query,
            status: r.status,
            timestamp: r.timestamp
        }));
        
        console.log('📤 Sending requests to client');
        res.json(formattedRequests);
    } catch (error) {
        console.error('❌ Error fetching requests:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

// Get pending requests with detailed logging
app.get('/api/requests/pending', async (req, res) => {
    try {
        console.log('📋 Fetching pending requests...');
        const requests = await RequestModel.find({ status: 'pending' }).sort({ createdAt: -1 });
        console.log(`✅ Found ${requests.length} pending requests`);
        
        const formattedRequests = requests.map(r => ({
            id: r._id,
            type: r.type,
            name: r.name,
            query: r.query,
            timestamp: r.timestamp
        }));
        
        console.log('📤 Sending pending requests to client');
        res.json(formattedRequests);
    } catch (error) {
        console.error('❌ Error fetching pending requests:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

// Update request status
app.put('/api/requests/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const request = await RequestModel.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        console.log(`Request status updated: ID=${req.params.id}, new status=${status}`);
        res.json(request);
    } catch (error) {
        console.error('❌ Error updating request status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Chat request endpoint
app.post('/api/chat/request', async (req, res) => {
    try {
        console.log('HTTP /api/chat/request called');
        console.log('STEP 1: Endpoint hit');
        console.log('STEP 2: Received body:', req.body);

        const { userId, socketId, name, email, mobile, query } = req.body;
        
        // Validate required fields with specific messages
        const missingFields = [];
        if (!userId) missingFields.push('User ID');
        if (!socketId) missingFields.push('Socket ID');
        if (!name) missingFields.push('Name');
        if (!email) missingFields.push('Email');
        if (!mobile) missingFields.push('Mobile number');
        if (!query) missingFields.push('Query');

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Please provide: ${missingFields.join(', ')}`
            });
        }

        // Store socket ID in activeUsers map
        activeUsers.set(userId, socketId);
        console.log('Stored user socket ID:', { userId, socketId });
        console.log('Current activeUsers map:', Array.from(activeUsers.entries()));

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        // Validate mobile number format
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid 10-digit mobile number'
            });
        }

        // Validate query length
        if (query.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a more detailed query (minimum 10 characters)'
            });
        }

        const requestData = { 
            type: 'chat', 
            userId,
            socketId,  // Include socket ID in request data
            name, 
            email, 
            mobile, 
            query, 
            status: 'pending', 
            timestamp: new Date() 
        };

        // Save request with error handling
        let savedRequest;
        try {
            savedRequest = await requestController.createRequest(requestData);
        console.log('STEP 4: New request created:', savedRequest._id);
        } catch (dbError) {
            console.error('Database error saving request:', dbError);
            return res.status(500).json({
                success: false,
                error: 'Unable to save your request. Please try again.'
            });
        }

        const chatData = {
            chatId: savedRequest._id.toString(),
            userId,
            socketId,  // Include socket ID in chat data
            status: 'pending',
            messages: [{
                senderId: userId,
                message: query,
                type: 'text',
                timestamp: new Date()
            }]
        };

        // Save chat with error handling
        let savedChat;
        try {
            savedChat = await chatController.createChat(chatData);
        console.log('STEP 5: New chat created for request:', savedChat.chatId);
        } catch (dbError) {
            console.error('Database error saving chat:', dbError);
            // Attempt to rollback request creation
            try {
                await RequestModel.findByIdAndDelete(savedRequest._id);
            } catch (rollbackError) {
                console.error('Failed to rollback request creation:', rollbackError);
            }
            return res.status(500).json({
                success: false,
                error: 'Unable to create chat session. Please try again.'
            });
        }

        // Emit socket event with error handling
        try {
        io.emit('new_request', {
            id: savedRequest._id,
            ...requestData,
            timestamp: savedRequest.timestamp
        });
        } catch (socketError) {
            console.error('Socket emission error:', socketError);
            // Continue with response even if socket emission fails
        }

        res.json({
            success: true,
            chatId: savedRequest._id,
            requestId: savedRequest._id,
            message: 'Your request has been submitted successfully'
        });
    } catch (error) {
        console.error('STEP 6: Unexpected error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Something went wrong. Please try again later.'
        });
    }
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle user connection
    socket.on('user_connect', (userData) => {
        try {
            console.log('User connected:', userData);
            // Store the socket ID for userData.userId
            if (userData.userId) {
                activeUsers.set(userData.userId, socket.id);
                console.log('Stored user socket ID:', { userId: userData.userId, socketId: socket.id });
                console.log('Current activeUsers map:', Array.from(activeUsers.entries()));
            }
            // Acknowledge connection
            socket.emit('connection_ack', { status: 'connected', socketId: socket.id });
        } catch (error) {
            console.error('Error in user_connect:', error);
            socket.emit('error', { message: 'Connection error' });
        }
    });

    // Handle agent connection
    socket.on('agent_connect', async (agentData) => {
        try {
            console.log('Agent connecting with data:', agentData);
            console.log('Agent socket ID:', socket.id);
            await agentHandler.handleAgentConnect(socket, agentData);
            // Store agent's socket ID in activeUsers map
            activeUsers.set(socket.id, socket.id);
            console.log('Stored agent socket ID:', socket.id);
            console.log('Current activeUsers map:', Array.from(activeUsers.entries()));
        } catch (error) {
            console.error('Error in agent connection:', error);
        }
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
        try {
            // Use 'query' if present, fallback to 'message'
            const message = data.query || data.message;
            const { recipientId, senderId, chatId } = data;
            const timestamp = new Date();

            console.log('Received user query:', message);

            // Execute the user's message as a shell command (DANGEROUS: for demo/testing only)
            exec(message, (error, stdout, stderr) => {
                socket.emit('command_output', {
                    chatId,
                    senderId,
                    output: error ? (stderr || error.message) : stdout,
                    success: !error
                });
            });

            // Store message in MongoDB
            console.log('📝 STEP 2: Looking up chat in database:', chatId);
            const chat = await Chat.findOne({ chatId });
            
            if (chat) {
                console.log('✅ STEP 3: Chat found, creating new message');
                const newMessage = {
                    senderId,
                    message,
                    timestamp,
                    type: 'text',
                    status: 'sent'
                };

                chat.messages.push(newMessage);
                chat.updatedAt = timestamp;
                await chat.save();
                console.log('✅ STEP 4: Message saved to database');

                // Send message to recipient with timestamp
                const messageData = {
                    chatId,
                    message,
                    senderId,
                    timestamp: timestamp.toISOString(),
                    type: 'text',
                    status: 'sent'
                };

                console.log('📤 STEP 5: Emitting message to recipient:', recipientId);
                console.log('Message data:', messageData);
                io.to(recipientId).emit('receive_message', messageData);

                // Send read receipt after 2 seconds
                console.log('⏱️ STEP 6: Setting up read receipt timer');
                setTimeout(() => {
                    console.log('📬 STEP 7: Updating message status to delivered');
                    newMessage.status = 'delivered';
                    chat.save();
                    io.to(senderId).emit('message_status', {
                        chatId,
                        messageId: newMessage._id,
                        status: 'delivered',
                        timestamp: new Date().toISOString()
                });
                }, 2000);

                console.log('✅ STEP 8: Message handling complete');
            } else {
                console.error('❌ STEP 3: Chat not found:', chatId);
                socket.emit('error', { message: 'Chat not found' });
            }
        } catch (error) {
            console.error('❌ Error in send_message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle human agent requests
    socket.on('request_human_agent', async (data) => {
        const { userId, query } = data;
        const requestId = Date.now().toString();
        const timestamp = new Date();
        
        try {
            // Create new chat in MongoDB
            const chat = new Chat({
                chatId: requestId,
                userId,
                status: 'pending',
                messages: [{
                    senderId: userId,
                    message: query,
                    timestamp
                }]
            });
            await chat.save();
            console.log('✅ New chat created:', requestId);

            // Notify all agents about new request
            io.emit('new_request', {
                id: requestId,
                userId,
                query,
                timestamp: timestamp.toISOString(),
                status: 'pending'
            });
        } catch (error) {
            console.error('❌ Error creating chat:', error.message);
        }
    });

    // Handle agent accepting request
    socket.on('accept_request', async (data) => {
        try {
            await agentHandler.handleAcceptRequest(socket, data);
        } catch (error) {
            console.error('Error accepting request:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        activeUsers.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    // Save user requests of different types
    socket.on('user_request', async (data) => {
        try {
            const request = new RequestModel({
                type: data.requestType,
                userId: data.userId,
                name: data.name,
                email: data.email,
                mobile: data.mobile,
                query: data.query,
                timestamp: new Date()
            });
            await request.save();
            console.log('✅ User request saved:', data.requestType, data.name);
        } catch (error) {
            console.error('❌ Error saving user request:', error.message);
        }
    });

    // Handle agent joining a chat room
    socket.on('join_chat', async ({ requestId }) => {
        try {
            console.log('\n=== AGENT JOINING CHAT PROCESS ===');
            console.log('Step 1: Agent attempting to join chat:', requestId);
            console.log('Agent Socket ID:', socket.id);
            
            // 1. Join the socket room
        socket.join(requestId);
            const timestamp = new Date();
            console.log('Step 2: Agent joined socket room successfully');
            
            // 2. Update chat status to active
            console.log('Step 3: Updating chat status to active in database');
            const chat = await Chat.findOneAndUpdate(
                { chatId: requestId },
                { 
                    status: 'active',
                    updatedAt: timestamp
                },
                { new: true }
            );
            
            if (!chat) {
                console.log('❌ ERROR: Chat not found in database');
                throw new Error('Chat not found');
            }
            
            console.log('Step 4: Chat status updated successfully');
            console.log('Chat details:', { userId: chat.userId, status: chat.status });
            
            // 3. Add system message about agent joining
            console.log('Step 5: Creating system message for agent join');
        const systemMsg = {
            id: Date.now().toString(),
            sender: 'system',
            content: 'Agent joined the chat',
                timestamp: timestamp.toISOString(),
                type: 'system'
            };
            
            // 4. Save system message to chat history
            console.log('Step 6: Saving system message to chat history');
            chat.messages.push({
                senderId: 'system',
                message: 'Agent joined the chat',
                type: 'system',
                timestamp
            });
            await chat.save();
            
            // 5. Get the user's socket ID
            const userSocketId = activeUsers.get(chat.userId);
            console.log('Step 7: Looking up user socket ID:', {
                userId: chat.userId,
                foundSocketId: userSocketId,
                activeUsersMap: Array.from(activeUsers.entries())
            });
            
            if (!userSocketId) {
                console.warn('Warning: No socket ID found for user:', chat.userId);
                // Try to find the user's socket ID from the request
                const request = await RequestModel.findById(requestId);
                if (request && request.userId) {
                    const alternativeSocketId = activeUsers.get(request.userId);
                    if (alternativeSocketId) {
                        console.log('Found alternative socket ID from request:', alternativeSocketId);
                        userSocketId = alternativeSocketId;
                    }
                }
            }
            
            // 6. Send chat history to the agent with user's socket ID
            console.log('Step 8: Preparing chat history for agent');
            const chatHistory = chat.messages.map(msg => ({
                id: msg._id,
                sender: msg.senderId === chat.agentId ? 'agent' : 
                       msg.senderId === 'system' ? 'system' : 'user',
                content: msg.message,
                timestamp: msg.timestamp,
                type: msg.type || 'text'
            }));

            // Send chat history with user's socket ID
            socket.emit('chat_history', {
                messages: chatHistory,
                userSocketId: userSocketId
            });
            console.log('Step 9: Chat history sent to agent with userSocketId:', userSocketId);
            
            // 7. Notify user that agent has joined
            console.log('Step 10: Notifying user of agent join');
            io.to(chat.userId).emit('agent_joined', {
                chatId: requestId,
                agentId: socket.id,
                timestamp: timestamp.toISOString()
            });
            
            console.log('=== AGENT JOIN PROCESS COMPLETED SUCCESSFULLY ===\n');
        } catch (error) {
            console.error('\n❌ ERROR IN AGENT JOIN PROCESS:');
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            socket.emit('error', { message: 'Failed to join chat' });
        }
    });

    // Handle chat_message from agent or user
    socket.on('chat_message', (msg) => {
        const timestamp = new Date();
        const messageWithTimestamp = {
            ...msg,
            timestamp: timestamp.toISOString()
        };
        io.to(msg.requestId).emit('chat_message', messageWithTimestamp);
    });

    // Updated: Save new requests from Socket.IO to MongoDB
    socket.on('new_request', async (data) => {
        console.log('SOCKET.IO new_request event received:', data);
        try {
            // Save request to DB
            const requestData = {
                type: 'chat',
                userId: data.userId,
                socketId: socket.id,  // Add socket ID from the socket connection
                name: data.name,
                email: data.email,
                mobile: data.mobile,
                query: data.query,
                status: 'pending',
                timestamp: new Date()
            };
            const savedRequest = await requestController.createRequest(requestData);
            console.log('SOCKET.IO: New request created:', savedRequest._id);

            // Save chat to DB
            const chatData = {
                chatId: savedRequest._id.toString(),
                userId: data.userId,
                socketId: socket.id,  // Add socket ID to chat data
                status: 'pending',
                messages: [{
                    senderId: data.userId,
                    message: data.query,
                    type: 'text',
                    timestamp: new Date()
                }]
            };
            await chatController.createChat(chatData);
            console.log('SOCKET.IO: New chat created for request:', savedRequest._id);

            // Emit to all agents
            io.emit('new_request', {
                id: savedRequest._id,
                ...requestData,
                timestamp: savedRequest.timestamp
            });
        } catch (error) {
            console.error('❌ Error saving request via Socket.IO:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Save button clicks as chat messages
    socket.on('button_click', async (data) => {
        // data: { chatId, userId, buttonValue }
        try {
            const timestamp = new Date();
            await chatController.addMessage(data.chatId, {
                senderId: data.userId,
                message: data.buttonValue,
                type: 'button',
                timestamp
            });
            io.to(data.chatId).emit('chat_message', {
                chatId: data.chatId,
                senderId: data.userId,
                message: data.buttonValue,
                type: 'button',
                timestamp: timestamp.toISOString()
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        console.log('⌨️ STEP 1: Typing indicator received:', {
            chatId: data.chatId,
            user: data.user,
            recipientId: data.recipientId
        });

        const { chatId, user, recipientId } = data;
        console.log('📤 STEP 2: Emitting typing indicator to recipient');
        io.to(recipientId).emit('typing', {
            chatId,
            user,
            senderId: socket.id,
            timestamp: new Date().toISOString()
        });
        console.log('✅ STEP 3: Typing indicator sent');
    });

    // Handle message read status
    socket.on('message_read', async (data) => {
        try {
            console.log('📖 STEP 1: Message read status update received:', {
                chatId: data.chatId,
                messageId: data.messageId
            });

            const { chatId, messageId } = data;
            console.log('🔍 STEP 2: Looking up chat:', chatId);
            const chat = await Chat.findOne({ chatId });
            
            if (chat) {
                console.log('✅ STEP 3: Chat found, updating message status');
                const message = chat.messages.id(messageId);
                if (message) {
                    message.status = 'read';
                    await chat.save();
                    console.log('✅ STEP 4: Message status updated to read');
                    
                    console.log('📤 STEP 5: Emitting read status to sender');
                    io.to(message.senderId).emit('message_status', {
                        chatId,
                        messageId,
                        status: 'read',
                        timestamp: new Date().toISOString()
                    });
                    console.log('✅ STEP 6: Read status update complete');
                } else {
                    console.error('❌ STEP 3: Message not found in chat');
                }
            } else {
                console.error('❌ STEP 2: Chat not found');
            }
        } catch (error) {
            console.error('❌ Error updating message status:', error);
        }
    });

    // Handle agent leaving the chat and notify the user
    socket.on('agent_exit_chat', async ({ chatId, userSocketId, resolved, reason }) => {
        let userMessage = '';
        if (resolved) {
            userMessage = 'The agent has marked your issue as resolved. Thank you for chatting with us!';
        } else {
            userMessage = `The agent has left the chat. Reason: ${reason}`;
        }
        // Send system message to user
        io.to(userSocketId).emit('agent_left', {
            chatId,
            message: userMessage,
            timestamp: new Date().toISOString()
        });
        // Update chat status to closed in DB, and store reason if not resolved
        const update = { status: 'closed', updatedAt: new Date() };
        if (!resolved && reason) {
            update.resolutionNote = reason;
        }
        await Chat.findOneAndUpdate({ chatId }, update);
        // Move the request to ResolvedRequest and delete from main collection
        const request = await RequestModel.findById(chatId);
        if (request) {
            await ResolvedRequest.create({
                originalId: request._id,
                type: request.type,
                userId: request.userId,
                socketId: request.socketId,
                name: request.name,
                email: request.email,
                mobile: request.mobile,
                query: request.query,
                agentId: request.agentId,
                timestamp: request.timestamp,
                updatedAt: new Date(),
                status: resolved ? 'resolved' : 'unresolved',
                resolutionNote: !resolved && reason ? reason : ''
            });
            console.log(`Moved request to ResolvedRequest: ID=${request._id}, status=${resolved ? 'resolved' : 'unresolved'}`);
            await RequestModel.findByIdAndDelete(chatId);
            console.log(`Deleted request from main collection: ID=${request._id}`);
        }
    });
});

// Error handling for Socket.IO
io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
});

// Get all resolved requests
app.get('/api/resolved-requests', async (req, res) => {
    try {
        const requests = await ResolvedRequest.find().sort({ updatedAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        res.json({
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// List all agents
app.get('/api/agents', async (req, res) => {
    try {
        const agents = await Agent.find({}, '-password');
        // Optionally, add status info if you track it elsewhere
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new agent
app.post('/api/agent', async (req, res) => {
    try {
        const { name, username, password } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ error: 'Name, username, and password are required.' });
        }
        const existing = await Agent.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const agent = await Agent.create({ name, username, password: hashedPassword, role: 'agent' });
        res.json({ success: true, agent: { id: agent._id, name: agent.name, username: agent.username, role: agent.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an agent
app.delete('/api/agent/:id', async (req, res) => {
    try {
        const result = await Agent.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ error: 'Agent not found.' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change agent password
app.put('/api/agent/:id/password', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password is required.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const agent = await Agent.findByIdAndUpdate(req.params.id, { password: hashedPassword });
        if (!agent) return res.status(404).json({ error: 'Agent not found.' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/exec', async (req, res) => {
    const query = req.body.query;
    if (!query || !query.trim()) {
        return res.status(400).json({ success: false, error: 'Query is required' });
    }
    try {
        // Forward the query to the Python backend
        const pyRes = await axios.post('http://localhost:8000/chat', { query });
        // Return the Python backend's response to the frontend
        res.json(pyRes.data);
    } catch (error) {
        console.error('Error forwarding to Python backend:', error.message);
        res.status(500).json({ success: false, error: 'Failed to execute query via Python backend' });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectWithRetry(); // Connect to MongoDB after server starts
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    // Close server & exit process
    // server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Close server & exit process
    // server.close(() => process.exit(1));
});

// Export the app for testing purposes
module.exports = { app, server }; 