const { body, validationResult } = require('express-validator');

// Validation middleware for request creation
const validateRequest = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please enter a valid email'),
    
    body('mobile')
        .trim()
        .notEmpty()
        .withMessage('Mobile number is required')
        .matches(/^[0-9]{10}$/)
        .withMessage('Please enter a valid 10-digit mobile number'),
    
    body('query')
        .trim()
        .notEmpty()
        .withMessage('Query is required')
        .isLength({ min: 10 })
        .withMessage('Query must be at least 10 characters long'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateAgent = (req, res, next) => {
    const { name, email, password } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push('Valid email is required');
    }

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

module.exports = {
    validateRequest,
    validateAgent
}; 