const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Agent = require('./models/Agent');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaganmandla09:Harsha%40789@cluster0.ll2kqdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function addAgent() {
    await mongoose.connect(MONGODB_URI);
    const username = 'harsha';
    const name = 'harsha';
    const password = 'Harsha@123';
    const email = 'jharshavardhan2004@gmail.com';
    const role = 'agent';
    const agentId = new mongoose.Types.ObjectId().toString();

    const agentExists = await Agent.findOne({ username });
    if (agentExists) {
        console.log('Agent already exists:', username);
        mongoose.disconnect();
        return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await Agent.create({
        agentId,
        username,
        name,
        password: hashedPassword,
        email,
        role
    });
    console.log(`✅ Agent created: username=${username}, name=${name}, agentId=${agentId}`);
    mongoose.disconnect();
}

addAgent(); 