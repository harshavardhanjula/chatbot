const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const agentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    status: {
        type: String,
        enum: ['online', 'busy', 'offline'],
        default: 'offline'
    },
    activeChats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
agentSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 8);
    }
    next();
});

// Method to compare password
agentSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// Method to generate auth token
agentSchema.methods.generateAuthToken = function() {
    const token = jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET, {
        expiresIn: '24h'
    });
    return token;
};

module.exports = mongoose.model('Agent', agentSchema); 