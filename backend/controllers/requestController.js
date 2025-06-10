const Request = require('../models/Request');

exports.createRequest = async (data) => {
    const request = new Request(data);
    return await request.save();
};

exports.getAllRequests = async () => {
    return await Request.find().sort({ createdAt: -1 });
};

exports.getPendingRequests = async () => {
    return await Request.find({ status: 'pending' }).sort({ createdAt: -1 });
}; 