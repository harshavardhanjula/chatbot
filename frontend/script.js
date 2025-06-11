import socket from './socket.js';

document.addEventListener('DOMContentLoaded', () => {
    /**
     * Cleans and extracts the actual response text from bot messages
     * @param {string} text - The raw text to clean
     * @returns {string} The cleaned response text
     */
    function cleanBotResponse(text) {
        if (!text) return '';
        
        // First convert to string and clean up whitespace
        let cleaned = text.toString()
            .replace(/\\n/g, ' ')  // Replace newlines with spaces
            .replace(/\\"/g, '"')  // Unescape quotes
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
            
        try {
            // Try to parse as JSON if it looks like JSON
            if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || 
                (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
                const parsed = JSON.parse(cleaned);
                if (parsed && typeof parsed === 'object') {
                    // If response has an 'answer' or 'response' field, use that
                    if (parsed.answer) return parsed.answer.trim();
                    if (parsed.response) return parsed.response.trim();
                    
                    // If no specific field, stringify and process as text
                    cleaned = JSON.stringify(parsed);
                }
            }
        } catch (e) {
            // Not a valid JSON, continue with text processing
        }
        
        // Remove common prefixes like "Answer:" or "Response:"
        const patterns = [
            // Matches "Answer: actual text"
            /(?:answer|response)[\s:]*([\s\S]*)/i,
            // Matches "...? Answer: actual text"
            /[^?]+\?\s*(?:answer|response)[\s:]*([\s\S]*)/i
        ];
        
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match && match[1]) {
                cleaned = match[1].trim();
                break;
            }
        }
        
        // Clean up any remaining escape sequences
        cleaned = cleaned
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
        
        // Remove any remaining leading/trailing quotes or spaces
        cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim();
        
        return cleaned;
    }

    // Function to add message to chat with status indicators
    function addMessage(message, author = 'bot', timestamp = null, status = 'sent') {
        // Clean the message if it's from the bot
        const displayMessage = author === 'bot' ? cleanBotResponse(message) : message;
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        // Force bot messages to be on the left side
        const messageClass = author === 'bot' ? 'message bot left' : `message ${author}`;
        messageDiv.className = messageClass;
        
        // Avatar
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        if (author === 'bot') {
            avatar.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/4712/4712035.png" alt="Bot"/>';
        } else if (author === 'user') {
            avatar.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/1946/1946429.png" alt="You"/>';
        } else if (author === 'agent') {
            avatar.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/4140/4140048.png" alt="Agent"/>';
        }
        
        // Message text
        const text = document.createElement('span');
        text.className = 'msg-text';
        
        // Time
        const timeSpan = document.createElement('span');
        timeSpan.className = 'msg-time';
        const messageDate = timestamp ? new Date(timestamp) : new Date();
        timeSpan.textContent = messageDate.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        // Status indicator
        const statusSpan = document.createElement('span');
        statusSpan.className = 'msg-status';
        if (author === 'user') {
            statusSpan.innerHTML = status === 'read' ? '✓✓' : 
                                 status === 'delivered' ? '✓✓' : '✓';
        }
        
        // Place time and status at the top
        text.innerHTML = '';
        text.appendChild(timeSpan);
        if (author === 'user') {
            text.appendChild(statusSpan);
        }
        text.appendChild(document.createElement('br'));
        text.innerHTML += displayMessage.replace(/\n/g, '<br>');
        
        // Layout
        if (author === 'user') {
            messageDiv.appendChild(text);
            messageDiv.appendChild(avatar);
        } else {
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(text);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Mark message as read if it's from agent
        if (author === 'agent' && currentChatId) {
            socket.emit('message_read', {
                chatId: currentChatId,
                messageId: messageDiv.id
            });
        }
    }

    const chatWidget = document.getElementById('chatWidget');
    const chatHeader = document.getElementById('chatHeader');
    const chatBody = document.getElementById('chatBody');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    // Connection status logging
    socket.on('connect', () => {
        console.log('✅ WebSocket Connected! Socket ID:', socket.id);
        // Log the userId for debugging
        console.log('User ID (socket.id):', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('❌ WebSocket Disconnected!');
        addMessage('Disconnected from support system. Trying to reconnect...', 'bot');
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket Connection Error:', error.message);
        addMessage(`Connection error: ${error.message}. Please check your internet connection.`, 'bot');
    });

    let currentChatId = null;
    let currentAgentId = null;

    // Connect as user
    console.log('Emitting user_connect');
    socket.emit('user_connect', {
        name: `User_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date()
    });

    socket.on('connection_ack', (data) => {
        console.log('Received connection_ack:', data);
    });

    let isMinimized = false;

    // Minimize/Maximize chat widget
    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMinimized = !isMinimized;
        chatBody.style.display = isMinimized ? 'none' : 'flex';
        minimizeBtn.textContent = isMinimized ? '+' : '−';
    });

    // Show options as a message bubble inside chat-messages
    function showOptions() {
        // Remove any existing options
        const oldOptions = document.getElementById('chatOptions');
        if (oldOptions) oldOptions.remove();
        
        // Create options container with side-by-side buttons
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'chat-options';
        optionsContainer.id = 'chatOptions';
        
        // Create first row
        const firstRow = document.createElement('div');
        firstRow.className = 'options-row';
        firstRow.style.display = 'flex';
        firstRow.style.gap = '10px';
        firstRow.style.width = '100%';
        firstRow.style.marginBottom = '10px';
        
        // Create second row
        const secondRow = document.createElement('div');
        secondRow.className = 'options-row';
        secondRow.style.display = 'flex';
        secondRow.style.gap = '10px';
        secondRow.style.width = '100%';
        
        // Define options with their respective rows
        const options = [
            { text: 'Book Appointment', row: firstRow },
            { text: 'Raise a Ticket', row: firstRow },
            { text: 'Request Human Agent', row: secondRow, fullWidth: true }
        ];
        
        // Create and append buttons
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn' + (option.fullWidth ? ' full-width' : '');
            btn.textContent = option.text;
            btn.id = option.text.toLowerCase().replace(/\s+/g, '') + 'Btn';
            
            // Button styles
            btn.style.flex = option.fullWidth ? '1 1 100%' : '1 1 45%';
            btn.style.minWidth = option.fullWidth ? '100%' : '140px';
            btn.style.padding = '10px 15px';
            btn.style.borderRadius = '20px';
            btn.style.border = '2px solid #ff7f50';
            btn.style.background = '#fff';
            btn.style.color = '#ff7f50';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.3s ease';
            btn.style.fontSize = '0.9em';
            btn.style.textAlign = 'center';
            btn.style.whiteSpace = 'nowrap';
            btn.style.overflow = 'hidden';
            btn.style.textOverflow = 'ellipsis';
            
            // Hover effects
            btn.onmouseover = () => {
                btn.style.background = '#ff7f50';
                btn.style.color = '#fff';
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            };
            
            btn.onmouseout = () => {
                btn.style.background = '#fff';
                btn.style.color = '#ff7f50';
                btn.style.transform = 'none';
                btn.style.boxShadow = 'none';
            };
            
            // Click handler
            btn.onclick = (e) => {
                e.preventDefault();
                if (option.text === 'Raise a Ticket') {
                    // Create a message container for the form
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message bot';
                    
                    // Add avatar
                    const avatar = document.createElement('span');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/4712/4712035.png" alt="Bot"/>';
                    
                    // Create message content
                    const content = document.createElement('div');
                    content.className = 'message-content';
                    
                    // Clone the ticket form and show it
                    const ticketForm = document.getElementById('ticketFormContainer').cloneNode(true);
                    ticketForm.id = 'activeTicketForm';
                    ticketForm.style.display = 'block';
                    messageDiv.appendChild(ticketForm);
                    
                    // Add to chat
                    chatMessages.appendChild(messageDiv);
                    
                    // Get form and button references
                    const activeTicketForm = document.getElementById('activeTicketForm');
                    const submitBtn = activeTicketForm ? activeTicketForm.querySelector('button[type="submit"]') : null;
                    const cancelBtn = activeTicketForm ? activeTicketForm.querySelector('#cancelTicketBtn') : null;

                    // Handle form submission
                    if (activeTicketForm) {
                        activeTicketForm.onsubmit = async function(e) {
                            e.preventDefault();
                            
                            if (!submitBtn) return;
                            
                            // Disable submit button and show loading state
                            const originalBtnText = submitBtn.innerHTML;
                            submitBtn.disabled = true;
                            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                            
                            try {
                                // Get form data from the active form
                                const ticketForm = e.target;
                                const ticketData = {
                                    name: ticketForm.querySelector('#ticketName').value,
                                    email: ticketForm.querySelector('#ticketEmail').value,
                                    phone: ticketForm.querySelector('#ticketPhone').value,
                                    subject: ticketForm.querySelector('#ticketSubject').value,
                                    category: ticketForm.querySelector('#ticketCategory').value,
                                    description: ticketForm.querySelector('#ticketDescription').value,
                                    timestamp: new Date().toISOString(),
                                    status: 'open'
                                };
                                
                                // Save ticket to backend
                                const apiUrl = 'http://localhost:5000/api/tickets';
                                console.log('Sending request to:', apiUrl, 'with data:', ticketData);
                                
                                const response = await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(ticketData)
                                });

                                if (!response.ok) {
                                    const errorText = await response.text();
                                    console.error('Server responded with status:', response.status, 'Response:', errorText);
                                    throw new Error(`Server error: ${response.status} - ${errorText}`);
                                }

                                const result = await response.json();
                                console.log('Server response:', result);

                                // Add user's ticket as a message
                                const ticketMessage = `
                                    <div style="margin-bottom: 8px;">
                                        <div style="font-weight: 500; color: #333;">New Ticket Submitted</div>
                                        <div style="font-size: 0.9em; color: #555;">${ticketData.subject}</div>
                                    </div>
                                `;
                                
                                // Add the ticket summary as a bot message
                                const ticketSummary = document.createElement('div');
                                ticketSummary.className = 'message bot';
                                ticketSummary.innerHTML = `
                                    <span class="avatar">
                                        <img src="https://cdn-icons-png.flaticon.com/512/4712/4712035.png" alt="Bot"/>
                                    </span>
                                    <span class="msg-text">${ticketMessage}</span>`;
                                chatMessages.appendChild(ticketSummary);
                                
                                // Show confirmation message with ticket reference
                                const confirmationMessage = `Thank you for submitting your ticket, ${ticketData.name}.\n\n` +
                                                        `Your ticket details have been received. ` +
                                                        `Reference: #${result.ticketId || 'N/A'}\n` +
                                                        `We'll get back to you soon at ${ticketData.email}.`;
                                
                                addMessage(confirmationMessage, 'bot');
                                
                                // Reset form and show options
                                if (ticketForm) {
                                    ticketForm.reset();
                                    const ticketFormContainer = ticketForm.closest('.ticket-form-container');
                                    if (ticketFormContainer) {
                                        ticketFormContainer.style.display = 'none';
                                    }
                                    const chatOptions = document.getElementById('chatOptions');
                                    if (chatOptions) chatOptions.style.display = 'flex';
                                }
                                
                                // Emit socket event with the ticket ID from the server
                                if (result.ticketId) {
                                    socket.emit('new_ticket', { ...ticketData, _id: result.ticketId });
                                }
                                
                            } catch (error) {
                                console.error('Error saving ticket:', error);
                                addMessage('Sorry, there was an error saving your ticket. Please try again later.', 'bot');
                            } finally {
                                // Re-enable the submit button and restore original text
                                if (submitBtn) {
                                    submitBtn.disabled = false;
                                    submitBtn.innerHTML = originalBtnText;
                                }
                            }
                            
                            // Scroll to show the new messages
                            scrollChatToBottom();
                        };
                    }
                    
                    // Handle cancel button
                    if (cancelBtn) {
                        cancelBtn.onclick = function(e) {
                            e.preventDefault();
                            if (messageDiv && messageDiv.parentNode) {
                                messageDiv.remove();
                            }
                            showOptions();
                        };
                    }
                    
                    // Focus the first input field
                    const firstInput = ticketForm.querySelector('input, select, textarea');
                    if (firstInput) firstInput.focus();
                } else {
                    handleOptionClick(option.text);
                }
            };
            
            option.row.appendChild(btn);
        });
        
        // Add rows to container
        optionsContainer.appendChild(firstRow);
        optionsContainer.appendChild(secondRow);
        
        // Add to chat messages
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(optionsContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Initialize event listeners for the ticket form
        const raiseTicketBtn = document.getElementById('raiseticketBtn');
        const ticketFormContainer = document.getElementById('ticketFormContainer');
        const ticketForm = document.getElementById('ticketForm');
        const cancelTicketBtn = document.getElementById('cancelTicketBtn');
        
        if (raiseTicketBtn) {
            raiseTicketBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('chatOptions').style.display = 'none';
                ticketFormContainer.style.display = 'block';
                document.getElementById('ticketSubject').focus();
            });
        }
        
        if (cancelTicketBtn) {
            cancelTicketBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ticketFormContainer.style.display = 'none';
                // Keep the options visible
                document.getElementById('chatOptions').style.display = 'flex';
                // Scroll back to options
                document.getElementById('chatOptions').scrollIntoView({ behavior: 'smooth' });
            });
        }
        
        if (ticketForm) {
            ticketForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const ticketData = {
                    subject: document.getElementById('ticketSubject').value,
                    priority: document.getElementById('ticketPriority').value,
                    category: document.getElementById('ticketCategory').value,
                    description: document.getElementById('ticketDescription').value,
                    timestamp: new Date().toISOString()
                };
                
                // Add user's ticket as a message
                addMessage(`Ticket: ${ticketData.subject}\nPriority: ${ticketData.priority}\nCategory: ${ticketData.category}\n\n${ticketData.description}`, 'user');
                
                // Show confirmation message
                addMessage('Thank you for submitting your ticket. Our team will get back to you shortly. Your ticket has been created with reference #' + Math.floor(10000 + Math.random() * 90000), 'bot');
                
                // Reset and hide form
                ticketForm.reset();
                ticketFormContainer.style.display = 'none';
                optionsContainer.style.display = 'flex';
                
                // Emit socket event to notify admin about new ticket
                socket.emit('new_ticket', ticketData);
                
                // Scroll to bottom of chat
                scrollChatToBottom();
            });
        }
    }

    // Initial greeting and options
    function showInitialGreeting() {
        addMessage('Greetings. Welcome to Angadi World Technologies.', 'bot');
        addMessage('How may I assist you?', 'bot');
        addMessage('Please select one of the options to know more, or ask your own question.', 'bot');
        showOptions();
    }

    // Store last user message for optional query
    let lastUserQuery = '';

    // Track the last option clicked for escalation
    let lastOptionClicked = '';

    // Function to show contact info as a chat bubble
    function showContactInfo() {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'message bot contact-info-bubble';
        infoDiv.innerHTML = `
            <div class="contact-info-title">Contact Information</div>
            <div class="contact-info-row"><b>Call us</b></div>
            <div class="contact-info-row">+91-9110314465</div>
            <div class="contact-info-row"><b>UK</b></div>
            <div class="contact-info-row">+44 7918255464</div>
            <div class="contact-info-row"><b>Email us</b></div>
            <div class="contact-info-row">info@angadiworldtech.com</div>
        `;
        document.getElementById('chat-messages').appendChild(infoDiv);
        document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    }

    // Function to show contact form as a chat bubble
    function showContactForm({ requireQuery = false, prefillQuery = '' } = {}) {
        // Remove any existing form
        const oldForm = document.getElementById('contactFormBubble');
        if (oldForm) oldForm.remove();
        
        // Find the chat container (try both possible IDs)
        const chatContainer = document.getElementById('chat-messages') || document.getElementById('chatMessages');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }
        
        const formDiv = document.createElement('div');
        formDiv.className = 'message bot';
        formDiv.id = 'contactFormBubble';
        formDiv.innerHTML = `
            <form id="contactForm" class="contact-form">
                <div style="font-weight:bold; margin-bottom:4px;">Contact Information</div>
                <div style="font-size:0.92em; margin-bottom:8px;">Please enter your contact details</div>
                <div class="input-group"><span class="input-icon">👤</span><input type="text" name="name" placeholder="Your Name" required></div>
                <div class="input-group"><span class="input-icon">✉️</span><input type="email" name="email" placeholder="Email Address" required></div>
                <div class="input-group"><span class="input-icon">🇮🇳 +91</span><input type="tel" name="mobile" placeholder="Mobile Number" required pattern="[0-9]{10,15}"></div>
                <div class="input-group"><span class="input-icon">💬</span><input type="text" name="query" placeholder="Your Query" ${requireQuery ? 'required' : ''} value="${prefillQuery}"></div>
                <div class="form-btn-row">
                  <button type="submit" class="submit-btn">Submit</button>
                  <button type="button" class="cancel-btn">Cancel</button>
                </div>
            </form>
        `;
        
        chatContainer.appendChild(formDiv);
        scrollChatToBottom();
        const form = document.getElementById('contactForm');
        form.onsubmit = function(e) {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(this).entries());
            data.userId = socket.id;
            data.socketId = socket.id;
            data.timestamp = new Date().toISOString();
            data.status = 'pending';

            console.log('Submitting chat request:', data);

            fetch('http://localhost:5000/api/chat/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(response => {
                if (response.success) {
                    addMessage(response.message || 'Thank you! Your request has been received.', 'bot', new Date());
                    // Clear the form
                    this.reset();
                } else {
                    addMessage(response.error || 'There was an error submitting your request.', 'bot', new Date());
                }
            })
            .catch(error => {
                console.error('Error submitting request:', error);
                addMessage('Unable to connect to the server. Please try again later.', 'bot', new Date());
            });
            formDiv.remove();
        };
        formDiv.querySelector('.cancel-btn').onclick = function() {
            formDiv.remove();
        };
    }

    // Helper function to scroll chat to bottom
    function scrollChatToBottom() {
        var chatMessages = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Show typing indicator
    function showTypingIndicator(message = 'Typing...') {
        const chatMessages = document.getElementById('chat-messages') || document.getElementById('chatMessages');
        if (!chatMessages) {
            console.error('Chat messages container not found');
            return null;
        }
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        // Create typing dots animation
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <span>${message}</span>
                <span class="dot">.</span>
                <span class="dot">.</span>
                <span class="dot">.</span>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    // Hide typing indicator
    function hideTypingIndicator(typingElement) {
        if (typingElement && typingElement.parentNode) {
            typingElement.remove();
        } else {
            // If element reference is lost, try to find and remove by ID
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }
    }

    // Option button click handler
    function handleOptionClick(option) {
        lastOptionClicked = option;
        addMessage(option, 'user', new Date());
        lastUserQuery = '';
        
        // Show typing indicator
        const typingIndicator = showTypingIndicator('Please wait while we connect you to a human agent...');
        
        setTimeout(() => {
            // Remove typing indicator
            hideTypingIndicator(typingIndicator);
            
            // For both 'Book Appointment' and 'Request Human Agent', show the contact form
            showContactForm({ 
                requireQuery: true, 
                prefillQuery: `I need help with: ${option}` 
            });
            
            // Notify the server about the human agent request
            socket.emit('request_human_agent', {
                userId: socket.id,
                query: `User requested human agent via: ${option}`
            });
        }, 1000);
    }

        // Show greeting and options on load
    showInitialGreeting();

    // Ticket form elements
    const raiseTicketBtn = document.getElementById('raiseTicketBtn');
    const ticketFormContainer = document.getElementById('ticketFormContainer');
    const ticketForm = document.getElementById('ticketForm');
    const cancelTicketBtn = document.getElementById('cancelTicketBtn');
    const chatOptions = document.getElementById('chatOptions');

    // Add event listeners only if elements exist
    if (raiseTicketBtn && ticketFormContainer && chatOptions) {
        // Show ticket form
        raiseTicketBtn.addEventListener('click', () => {
            chatOptions.style.display = 'none';
            ticketFormContainer.style.display = 'block';
            // Auto-focus the subject field when form is shown
            const subjectField = document.getElementById('ticketSubject');
            if (subjectField) subjectField.focus();
        });
    }

    if (cancelTicketBtn && ticketFormContainer && chatOptions) {
        // Hide ticket form
        cancelTicketBtn.addEventListener('click', () => {
            ticketFormContainer.style.display = 'none';
            chatOptions.style.display = 'flex';
        });
    }

    // Handle ticket form submission
    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ticketData = {
            name: document.getElementById('ticketName').value,
            email: document.getElementById('ticketEmail').value,
            phone: document.getElementById('ticketPhone').value,
            subject: document.getElementById('ticketSubject').value,
            category: document.getElementById('ticketCategory').value,
            description: document.getElementById('ticketDescription').value
        };

        try {
            // Show loading state
            const submitBtn = ticketForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

            // Save ticket to backend
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(ticketData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create ticket');
            }

            // Show confirmation message with ticket details
            const confirmationMessage = `Thank you for submitting your ticket, ${ticketData.name}.\n\n` +
                                    `Your ticket details:\n` +
                                    `• Subject: ${ticketData.subject}\n` +
                                    `• Category: ${ticketData.category}\n` +
                                    `• Status: Open\n` +
                                    `• Reference: #${result.ticketId}\n\n` +
                                    `We've sent a confirmation to ${ticketData.email}. ` +
                                    `Our team will get back to you shortly.`;
            
            addMessage(confirmationMessage, 'bot');
            
            // Reset and hide form
            ticketForm.reset();
            ticketFormContainer.style.display = 'none';
            chatOptions.style.display = 'flex';
            
            // Emit socket event to notify admin about new ticket
            socket.emit('new_ticket', { ...ticketData, _id: result.ticketId });
            
        } catch (error) {
            console.error('Error creating ticket:', error);
            addMessage('Sorry, there was an error submitting your ticket. Please try again later.', 'bot');
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
        
        // Scroll to bottom of chat
        scrollChatToBottom();
    });

    // Handle user message when no agent is available
    async function handleUserMessage(message) {
        // Add user message to chat
        addMessage(message, 'user', new Date());
        lastUserQuery = message;
        
        try {
            // Show typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            typingIndicator.innerHTML = '<span></span><span></span><span></span>';
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Send message to backend API
            const response = await fetch('http://localhost:5000/api/exec', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: message }),
                credentials: 'include'  // Include cookies for authentication
            });
            
            // Remove typing indicator
            if (typingIndicator.parentNode) {
                typingIndicator.remove();
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // If the response indicates escalation is needed
                if (data.escalated) {
                    addMessage(data.response || "I'll connect you with our team who can assist you better.", 'bot', new Date());
                    showContactForm({ requireQuery: true, prefillQuery: message });
                } else {
                    // Show the AI response
                    addMessage(data.response, 'bot', new Date());
                }
            } else {
                throw new Error(data.error || 'Failed to process your request');
            }
        } catch (error) {
            console.error('Error processing message:', error);
            // Fallback to default message if API call fails
            addMessage("I'm sorry, but I can't process your request at the moment. Would you like to speak with a human agent?", 'bot', new Date());
            showContactForm({ requireQuery: true, prefillQuery: message });
        }
    }

    // Socket event handlers
    socket.on('receive_message', (data) => {
        if (data.senderId === currentAgentId) {
            addMessage(data.message, 'agent', data.timestamp, data.status);
        }
    });

    socket.on('chat_message', (msg) => {
        if (msg.sender === 'system') {
            addMessage(`<em>${msg.content}</em>`, 'bot', msg.timestamp);
        } else if (msg.sender === 'agent') {
            addMessage(msg.content, 'agent', msg.timestamp, msg.status);
        } else if (msg.sender === 'user') {
            addMessage(msg.content, 'user', msg.timestamp, msg.status);
        }
    });

    socket.on('message_status', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageDiv) {
            const statusSpan = messageDiv.querySelector('.msg-status');
            if (statusSpan) {
                statusSpan.innerHTML = data.status === 'read' ? '✓✓' : '✓✓';
            }
        }
    });

    socket.on('agent_joined', (data) => {
        currentChatId = data.chatId;
        currentAgentId = data.agentId;
        addMessage('You are now connected to an agent.', 'system', data.timestamp);
        showTypingIndicator('Agent is typing...');
    });

    socket.on('chat_history', (messages) => {
        // Render all previous messages
        messages.forEach(msg => {
            addMessage(msg.content, msg.sender, msg.timestamp, msg.status);
        });
        // Show confirmation at the top for the agent
        addMessage('You have joined the chat with the user.', 'system', new Date().toISOString());
    });

    socket.on('agent_left', (data) => {
        addMessage(`<em>${data.message}</em>`, 'bot', data.timestamp);
    });

    // Typing indicator logic
    let typingTimeout;
    userInput.addEventListener('input', () => {
        if (currentChatId && currentAgentId) {
            socket.emit('typing', { 
                chatId: currentChatId, 
                user: 'user',
                recipientId: currentAgentId 
            });
            
            // Debounce typing indicator
            clearTimeout(typingTimeout);
            
            // Only send typing indicator if we have an active chat and agent
            if (currentChatId && currentAgentId) {
                // Set new timeout with debounce
                typingTimeout = setTimeout(() => {
                    try {
                        socket.emit('typing', {
                            chatId: currentChatId,
                            user: 'user',
                            recipientId: currentAgentId
                        });
                        
                        // Auto-stop typing after 3 seconds if no further input
                        typingTimeout = setTimeout(() => {
                            socket.emit('stop_typing', {
                                chatId: currentChatId,
                                user: 'user',
                                recipientId: currentAgentId
                            });
                        }, 3000);
                    } catch (error) {
                        console.error('Error sending typing indicator:', error);
                    }
                }, 300); // 300ms debounce
            }
        }
    });

    // Handle agent typing indicators
    socket.on('typing', (data) => {
        try {
            if (data.user === 'agent' && data.senderId === currentAgentId) {
                // Show typing indicator with agent name if available
                const agentName = data.agentName || 'Agent';
                showTypingIndicator(`${agentName} is typing...`);
                
                // Auto-hide typing indicator after 5 seconds as fallback
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    hideTypingIndicator();
                }, 5000);
            }
        } catch (error) {
            console.error('Error handling typing indicator:', error);
        }
    });

    // Handle stop typing events
    socket.on('stop_typing', (data) => {
        try {
            if (data.user === 'agent' && data.senderId === currentAgentId) {
                hideTypingIndicator();
            }
        } catch (error) {
            console.error('Error handling stop typing:', error);
        }
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showNotification('Connection error. Reconnecting...', 'error');
    });
    
    // Handle reconnection
    socket.on('reconnect', (attempt) => {
        console.log('Reconnected to server. Attempt:', attempt);
        showNotification('Reconnected to server', 'success');
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server. Reason:', reason);
        if (reason === 'io server disconnect') {
            // Reconnect after a short delay
            setTimeout(() => {
                socket.connect();
            }, 1000);
        }
    });

    function showTypingIndicator(message) {
        let indicator = document.getElementById('typingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typingIndicator';
            indicator.className = 'message bot typing-indicator';
            document.getElementById('chatMessages').appendChild(indicator);
        }
        indicator.textContent = message;
        indicator.style.display = 'block';
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Send message with status tracking
    function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            if (currentChatId && currentAgentId) {
                const timestamp = new Date().toISOString();
                const messageId = Date.now().toString();
                
                // Send message to agent
                socket.emit('send_message', {
                    message,
                    recipientId: currentAgentId,
                    senderId: socket.id,
                    chatId: currentChatId,
                    timestamp,
                    messageId
                });
                
                // Add message to chat with pending status
                addMessage(message, 'user', timestamp, 'sent');
                userInput.value = '';
            } else {
                handleUserMessage(message);
            }
        }
    }

    // Send message on button click
    sendBtn.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            if (currentChatId && currentAgentId) {
                const timestamp = new Date().toISOString();
                // Send message to agent
                socket.emit('send_message', {
                    message,
                    recipientId: currentAgentId,
                    senderId: socket.id,
                    chatId: currentChatId,
                    timestamp
                });
                addMessage(message, 'user', timestamp);
            } else {
                handleUserMessage(message);
            }
            userInput.value = '';
        }
    });

    // Send message on Enter key
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = userInput.value.trim();
            if (message) {
                if (currentChatId && currentAgentId) {
                    const timestamp = new Date().toISOString();
                    // Send message to agent
                    socket.emit('send_message', {
                        message,
                        recipientId: currentAgentId,
                        senderId: socket.id,
                        chatId: currentChatId,
                        timestamp
                    });
                    addMessage(message, 'user', timestamp);
                } else {
                    handleUserMessage(message);
                }
                userInput.value = '';
            }
        }
        });
    }
});