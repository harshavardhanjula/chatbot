// Admin Tickets Management
class TicketManager {
    constructor() {
        this.ticketsList = document.getElementById('tickets-list');
        this.ticketDetail = document.getElementById('ticket-detail');
        this.currentTicketId = null;
        this.initializeEventListeners();
        this.initializeFilters();
    }

    initializeEventListeners() {
        // Back to tickets list
        const backToTicketsBtn = document.getElementById('back-to-tickets');
        if (backToTicketsBtn) {
            backToTicketsBtn.addEventListener('click', () => this.showTicketList());
        }

        // Save ticket changes
        const saveTicketBtn = document.getElementById('save-ticket');
        if (saveTicketBtn) {
            saveTicketBtn.addEventListener('click', () => this.saveTicket());
        }

        // Resolve ticket
        const resolveTicketBtn = document.getElementById('resolve-ticket');
        if (resolveTicketBtn) {
            resolveTicketBtn.addEventListener('click', () => this.resolveTicket());
        }

        // Email customer
        const emailCustomerBtn = document.getElementById('email-customer');
        if (emailCustomerBtn) {
            emailCustomerBtn.addEventListener('click', () => this.emailCustomer());
        }

        // Add note
        const addNoteBtn = document.getElementById('add-note');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => this.addNote());
        }
    }


    initializeFilters() {
        const ticketStatusFilter = document.getElementById('ticket-status-filter');
        const ticketSearch = document.getElementById('ticket-search');
        let searchTimeout;

        if (ticketStatusFilter) {
            ticketStatusFilter.addEventListener('change', () => this.fetchTickets());
        }

        if (ticketSearch) {
            ticketSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.fetchTickets(e.target.value);
                }, 500);
            });
        }
    }


    async fetchTickets(search = '') {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const status = document.getElementById('ticket-status-filter')?.value || 'all';
            let url = 'http://localhost:5000/api/tickets';
            const params = new URLSearchParams();
            
            if (status !== 'all') params.append('status', status);
            if (search) params.append('search', search);
            
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch tickets');
            
            const { tickets } = await response.json();
            this.renderTickets(tickets);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            this.showNotification('Failed to load tickets', 'error');
        }
    }


    renderTickets(tickets) {
        if (!this.ticketsList) return;
        
        if (!tickets || tickets.length === 0) {
            this.ticketsList.innerHTML = '<div class="no-tickets">No tickets found</div>';
            return;
        }

        const html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>From</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(ticket => `
                        <tr>
                            <td>#${ticket._id.slice(-6)}</td>
                            <td>${ticket.subject}</td>
                            <td><span class="status-badge status-${ticket.status}">${this.formatStatus(ticket.status)}</span></td>
                            <td>${ticket.email}</td>
                            <td>${new Date(ticket.createdAt).toLocaleString()}</td>
                            <td>
                                <button class="btn-sm btn-view" data-id="${ticket._id}">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        this.ticketsList.innerHTML = html;
        
        // Add event listeners to view buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticketId = e.target.dataset.id;
                this.viewTicket(ticketId);
            });
        });
    }


    async viewTicket(ticketId) {
        try {
            console.log('Fetching ticket with ID:', ticketId);
            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.error('No authentication token found');
                return;
            }

            const url = `http://localhost:5000/api/tickets/${ticketId}`;
            console.log('Making request to:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`Failed to fetch ticket: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Ticket data received:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch ticket');
            }
            
            const ticket = data.ticket;
            this.currentTicket = ticket; // Store the full ticket object
            this.currentTicketId = ticket._id;
            console.log('Ticket loaded successfully:', ticket._id);
            
            // Update UI with ticket details
            document.getElementById('ticket-detail-subject').textContent = ticket.subject;
            document.getElementById('ticket-name').textContent = ticket.name || 'Not provided';
            document.getElementById('ticket-email').textContent = ticket.email || 'N/A';
            document.getElementById('ticket-phone').textContent = ticket.phone || 'N/A';
            document.getElementById('ticket-category').textContent = this.formatCategory(ticket.category);
            document.getElementById('ticket-created').textContent = new Date(ticket.createdAt).toLocaleString();
            document.getElementById('ticket-description').textContent = ticket.description;
            document.getElementById('ticket-status').value = ticket.status;
            
            // Update communication buttons
            this.updateCommunicationButtons(ticket);
            
            // Load notes
            this.loadNotes(ticketId);
            
            // Show ticket detail view
            this.showTicketDetail();
            
        } catch (error) {
            console.error('Error viewing ticket:', error);
            this.showNotification('Failed to load ticket details', 'error');
        }
    }
    
    updateCommunicationButtons(ticket) {
        const commsContainer = document.getElementById('ticket-communication');
        if (!commsContainer) return;
        
        // Create email body with ticket details
        const emailSubject = `Re: ${ticket.subject} (Ticket #${ticket._id})`;
        const emailBody = `Dear ${ticket.name || 'Valued Customer'},\n\n` +
                        `Thank you for contacting our support team regarding your ticket #${ticket._id}.\n\n` +
                        `Ticket Subject: ${ticket.subject}\n` +
                        `Status: ${this.formatStatus(ticket.status)}\n` +
                        `Created: ${new Date(ticket.createdAt).toLocaleString()}\n\n` +
                        `Our team is working on your request and we will get back to you as soon as possible.\n\n` +
                        `Best regards,\n` +
                        `${localStorage.getItem('adminName') || 'Support Team'}`;
        
        commsContainer.innerHTML = `
            <div class="communication-options">
                <h4>Contact Customer</h4>
                <div class="comms-buttons">
                    <a href="#" 
                       class="comms-btn email" 
                       id="email-customer" 
                       title="Send Email">
                        <i class="fas fa-envelope"></i> Email
                    </a>
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('start-google-meet')?.addEventListener('click', () => this.generateGoogleMeetLink());
        document.getElementById('make-call')?.addEventListener('click', () => this.initiatePhoneCall(ticket.phone));
        document.getElementById('copy-meet-link')?.addEventListener('click', () => this.copyToClipboard('meet-link'));
        
        // Add email button click handler
        document.getElementById('email-customer')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!ticket.email) {
                this.showNotification('No email address available for this ticket', 'error');
                return;
            }
            
            // Create email subject and body
            const emailSubject = `Re: ${ticket.subject} (Ticket #${ticket._id})`;
            const emailBody = `Dear ${ticket.name || 'Valued Customer'},\n\n` +
                           `Thank you for contacting our support team regarding your ticket #${ticket._id}.\n\n` +
                           `Ticket Subject: ${ticket.subject}\n` +
                           `Status: ${this.formatStatus(ticket.status)}\n` +
                           `Created: ${new Date(ticket.createdAt).toLocaleString()}\n\n` +
                           `Our team is working on your request and we will get back to you as soon as possible.\n\n` +
                           `Best regards,\n` +
                           `${localStorage.getItem('adminName') || 'Support Team'}`;
            
            // Encode the email components
            const encodedSubject = encodeURIComponent(emailSubject);
            const encodedBody = encodeURIComponent(emailBody);
            
            // Try to open Gmail in a new tab
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ticket.email)}&su=${encodedSubject}&body=${encodedBody}`;
            const newWindow = window.open(gmailUrl, '_blank');
            
            // Fallback to mailto: if popup is blocked
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                window.location.href = `mailto:${ticket.email}?subject=${encodedSubject}&body=${encodedBody}`;
            }
            
            // Log the email action
            this.addNote(`Email initiated to customer (${ticket.email})`);
        });
    }
    
    generateGoogleMeetLink() {
        // In a real app, you would generate a unique meeting link via Google Meet API
        // For demo purposes, we'll create a random meeting ID
        const meetingId = Math.random().toString(36).substring(2, 10);
        const meetLink = `https://meet.google.com/${meetingId}`;
        
        const meetLinkInput = document.getElementById('meet-link');
        const meetLinkContainer = document.getElementById('meet-link-container');
        
        if (meetLinkInput && meetLinkContainer) {
            meetLinkInput.value = meetLink;
            meetLinkContainer.style.display = 'flex';
            
            // Auto-select the text for easy copying
            meetLinkInput.select();
            
            this.showNotification('Google Meet link generated. Share it with the customer.', 'success');
        }
    }
    
    initiatePhoneCall(phoneNumber) {
        if (!phoneNumber) {
            this.showNotification('No phone number available for this ticket', 'error');
            return;
        }
        
        // In a real app, this would integrate with a telephony service
        // For now, we'll just show a confirmation
        if (confirm(`Call customer at ${phoneNumber}?`)) {
            // This will work on mobile devices with tel: links
            window.location.href = `tel:${phoneNumber}`;
        }
    }
    
    copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.select();
        document.execCommand('copy');
        
        // Show feedback
        const copyBtn = document.getElementById('copy-meet-link');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }
        
        this.showNotification('Link copied to clipboard', 'success');
    }


    async saveTicket() {
        if (!this.currentTicketId) return;
        
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            
            const status = document.getElementById('ticket-status').value;
            
            const response = await fetch(`http://localhost:5000/api/tickets/${this.currentTicketId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) throw new Error('Failed to update ticket');
            
            this.showNotification('Ticket updated successfully', 'success');
            this.fetchTickets();
            
        } catch (error) {
            console.error('Error updating ticket:', error);
            this.showNotification('Failed to update ticket', 'error');
        }
    }


    async addNote() {
        const newNoteInput = document.getElementById('new-note');
        if (!this.currentTicketId || !newNoteInput?.value.trim()) return;
        
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            
            const response = await fetch(`http://localhost:5000/api/tickets/${this.currentTicketId}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    text: newNoteInput.value.trim(),
                    author: this.getAdminNameFromToken(token) || 'Admin'
                })
            });
            
            if (!response.ok) throw new Error('Failed to add note');
            
            const { note } = await response.json();
            this.addNoteToUI(note);
            newNoteInput.value = '';
            this.showNotification('Note added successfully', 'success');
            
        } catch (error) {
            console.error('Error adding note:', error);
            this.showNotification('Failed to add note', 'error');
        }
    }


    async loadNotes(ticketId) {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/notes`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load notes');
            
            const { notes } = await response.json();
            const notesContainer = document.getElementById('ticket-notes');
            if (!notesContainer) return;
            
            notesContainer.innerHTML = ''; // Clear existing notes
            
            if (notes && notes.length > 0) {
                notes.forEach(note => this.addNoteToUI(note));
            } else {
                notesContainer.innerHTML = '<div class="no-notes">No notes yet</div>';
            }
            
        } catch (error) {
            console.error('Error loading notes:', error);
            const notesContainer = document.getElementById('ticket-notes');
            if (notesContainer) {
                notesContainer.innerHTML = '<div class="error">Failed to load notes</div>';
            }
        }
    }


    addNoteToUI(note) {
        const notesContainer = document.getElementById('ticket-notes');
        if (!notesContainer) return;
        
        const noteElement = document.createElement('div');
        noteElement.className = 'ticket-note';
        noteElement.innerHTML = `
            <div class="note-header">
                <strong>${note.author}</strong>
                <span class="note-date">${new Date(note.createdAt).toLocaleString()}</span>
            </div>
            <div class="note-text">${note.text}</div>
        `;
        
        // If this is the first note, clear the "no notes" message
        if (notesContainer.querySelector('.no-notes')) {
            notesContainer.innerHTML = '';
        }
        
        notesContainer.prepend(noteElement);
    }


    async resolveTicket() {
        if (!this.currentTicketId) return;
        
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            
            const response = await fetch(`/api/tickets/${this.currentTicketId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'resolved' })
            });
            
            if (!response.ok) throw new Error('Failed to resolve ticket');
            
            this.showNotification('Ticket marked as resolved', 'success');
            this.fetchTickets();
            this.showTicketList();
            
        } catch (error) {
            console.error('Error resolving ticket:', error);
            this.showNotification('Failed to resolve ticket', 'error');
        }
    }


    emailCustomer() {
        const email = document.getElementById('ticket-email')?.textContent;
        if (!email) return;
        
        const subject = `Re: ${document.getElementById('ticket-detail-subject')?.textContent || 'Your support ticket'}`;
        const mailtoLink = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
        window.open(mailtoLink, '_blank');
    }


    showTicketDetail() {
        if (this.ticketsList) this.ticketsList.style.display = 'none';
        if (this.ticketDetail) this.ticketDetail.style.display = 'block';
    }


    showTicketList() {
        if (this.ticketDetail) this.ticketDetail.style.display = 'none';
        if (this.ticketsList) this.ticketsList.style.display = 'block';
    }


    formatStatus(status) {
        const statusMap = {
            'open': 'Open',
            'in-progress': 'In Progress',
            'resolved': 'Resolved',
            'closed': 'Closed'
        };
        return statusMap[status] || status;
    }


    formatCategory(category) {
        if (!category) return '';
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }


    getAdminNameFromToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64));
            return payload.name || 'Admin';
        } catch (e) {
            console.error('Error parsing token:', e);
            return 'Admin';
        }
    }


    showNotification(message, type = 'info') {
        // Implement your notification system here
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Example: alert(message);
    }
}

// Initialize ticket manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make ticketManager globally available
    window.ticketManager = new TicketManager();
    
    // Check if we're already on the tickets tab
    if (document.getElementById('tickets-content')?.style.display === 'block') {
        window.ticketManager.fetchTickets();
    }
    
    // Refresh tickets every minute if on the tickets tab
    setInterval(() => {
        if (document.getElementById('tickets-content')?.style.display === 'block') {
            window.ticketManager.fetchTickets();
        }
    }, 60000);
});
