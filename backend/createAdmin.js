const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Import the Admin model
const Admin = require('./models/Admin');

// Default admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // Change this to a secure password

async function createAdmin() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username: ADMIN_USERNAME });
        
        if (existingAdmin) {
            console.log('Admin user already exists:');
            console.log(`Username: ${existingAdmin.username}`);
            console.log('ID:', existingAdmin._id);
            console.log('Role:', existingAdmin.role);
            process.exit(0);
        }

        // Create new admin
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        const admin = new Admin({
            username: ADMIN_USERNAME,
            password: hashedPassword,
            role: 'admin'
        });

        await admin.save();
        console.log('Admin user created successfully!');
        console.log(`Username: ${ADMIN_USERNAME}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log('IMPORTANT: Change this password after first login!');
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    } finally {
        // Close the connection
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Run the function
createAdmin();
