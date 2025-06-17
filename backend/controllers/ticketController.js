const Ticket = require('../models/Ticket');

exports.createTicket = async (req, res) => {
    try {
        const ticket = new Ticket(req.body);
        await ticket.save();
        res.status(201).json({ 
            success: true, 
            message: 'Ticket created successfully',
            ticketId: ticket._id
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating ticket',
            error: error.message 
        });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find().sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching tickets',
            error: error.message 
        });
    }
};

exports.getTicketById = async (req, res) => {
    console.log('getTicketById called with ID:', req.params.id);
    try {
        const ticket = await Ticket.findById(req.params.id);
        console.log('Ticket found:', ticket ? ticket._id : 'Not found');
        
        if (!ticket) {
            console.log('Ticket not found');
            return res.status(404).json({ 
                success: false, 
                message: 'Ticket not found' 
            });
        }
        
        console.log('Sending ticket data');
        res.json({ 
            success: true, 
            ticket: {
                _id: ticket._id,
                subject: ticket.subject,
                description: ticket.description,
                status: ticket.status,
                category: ticket.category,
                name: ticket.name,
                email: ticket.email,
                phone: ticket.phone,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            } 
        });
    } catch (error) {
        console.error('Error in getTicketById:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching ticket',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
