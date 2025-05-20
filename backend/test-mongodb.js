const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
    try {
        console.log('Testing MongoDB connection...');
        
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env file');
        }

        console.log('Connection string:', MONGODB_URI.replace(/:([^:]+)@/, ':********@'));
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 30000,
        });
        
        console.log('✅ Successfully connected to MongoDB');
        
        // List all databases (requires admin privileges)
        const adminDb = mongoose.connection.db.admin();
        const databases = await adminDb.listDatabases();
        console.log('Available databases:', databases.databases.map(db => db.name));
        
        // Close the connection
        await mongoose.connection.close();
        console.log('Connection closed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Error details:', {
            name: error.name,
            code: error.code,
            codeName: error.codeName,
            errorLabels: error.errorLabels || []
        });
        process.exit(1);
    }
};

testConnection();
