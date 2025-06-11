const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaganmandla09:Harsha%40789@cluster0.ll2kqdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function addAdmin() {
    await mongoose.connect(MONGODB_URI);
    const username = 'Sravan_Kumar_Angadi';
    const name = 'Sravan Kumar Angadi';
    const password = 'Sravan@123';
    const role = 'admin';

    const adminExists = await Admin.findOne({ username });
    if (adminExists) {
        console.log('Admin already exists:', username);
        mongoose.disconnect();
        return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await Admin.create({
        username,
        password: hashedPassword,
        role,
        name
    });
    console.log(`✅ Admin created: username=${username}, name=${name}`);
    mongoose.disconnect();
}

addAdmin(); 