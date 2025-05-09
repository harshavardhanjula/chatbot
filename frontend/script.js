import socket from './socket.js';

document.addEventListener('DOMContentLoaded', () => {
    // Function to add message to chat with status indicators
    function addMessage(message, author = 'bot', timestamp = null, status = 'sent') {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${author}`;
        
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
        text.innerHTML += message.replace(/\n/g, '<br>');
        
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
        // Clone the options template
        const optionsTemplate = document.createElement('div');
        optionsTemplate.className = 'chat-options';
        optionsTemplate.id = 'chatOptions';
        const options = [
            'Address', 'About Us', 'Contact Details', 'Book Appointment',
            'View Products/Services', 'Pricing', 'Our Customers', 'Request Human Agent'
        ];
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = () => handleOptionClick(option);
            optionsTemplate.appendChild(btn);
        });
        document.getElementById('chatMessages').appendChild(optionsTemplate);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
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
        document.getElementById('chatMessages').appendChild(infoDiv);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }

    // Function to show contact form as a chat bubble
    function showContactForm({ requireQuery = false, prefillQuery = '' } = {}) {
        // Remove any existing form
        const oldForm = document.getElementById('contactFormBubble');
        if (oldForm) oldForm.remove();
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
        document.getElementById('chatMessages').appendChild(formDiv);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
        const form = document.getElementById('contactForm');
        form.onsubmit = function(e) {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(this).entries());
            data.userId = socket.id;
            data.socketId = socket.id;
            data.timestamp = new Date().toISOString();

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

    // Option button click handler
    function handleOptionClick(option) {
        lastOptionClicked = option;
        addMessage(option, 'user', new Date());
        lastUserQuery = '';
        setTimeout(() => {
            let response = '';
            switch(option) {
                case 'Address':
                    addMessage('5th Floor, Rajapushpa Summit, Nanakramguda Rd, Financial District, Gachibowli, Hyderabad, Telangana 500008', 'bot', new Date());
                    addMessage('93/1,5,First Floor MRS Complex, Ramamurthy Nagar Main Rd, Ramamurthy Nagar, Bengaluru, Karnataka 560016', 'bot', new Date());
                    addMessage('1 Kesteven Close, Ilford, London IG6 3EP', 'bot', new Date());
                    return;
                case 'About Us':
                    addMessage('Angadi World Technologies', 'bot', new Date());
                    addMessage('Angadi World Technologies (AWT) specialises in a comprehensive suite of IT services, including website development, mobile app development, QR code technology solutions, digital marketing strategies, and project consulting to elevate your business.', 'bot', new Date());
                    return;
                case 'Contact Details':
                    addMessage('Call us<br>+91-9110314465', 'bot', new Date());
                    addMessage('UK<br>+44 7918255464', 'bot', new Date());
                    addMessage('Email us<br>info@angadiworldtech.com', 'bot', new Date());
                    showContactForm({ requireQuery: false, prefillQuery: lastUserQuery });
                    return;
                case 'Book Appointment':
                    showContactForm({ requireQuery: true, prefillQuery: '' });
                    return;
                case 'Pricing':
                case 'Our Customers':
                    addMessage("I can't provide this information. Please fill the contact form to request a human agent.", 'bot', new Date());
                    showContactForm({ requireQuery: false, prefillQuery: lastUserQuery });
                    return;
                case 'Request Human Agent':
                    showContactForm({ requireQuery: false, prefillQuery: lastUserQuery });
                    return;
                default:
                    response = 'Sorry, I could not find the information you requested.';
            }
            addMessage(response, 'bot', new Date());
        }, 700);
    }

    // Show greeting and options on load
    showInitialGreeting();

    // Override handleUserMessage to hide options after free text
    function handleUserMessage(message) {
        addMessage(message, 'user', new Date());
        lastUserQuery = message;
        setTimeout(() => {
            addMessage("I'm sorry, but I can't process your request at the moment. Would you like to speak with a human agent?", 'bot', new Date());
            showContactForm({ requireQuery: true, prefillQuery: message });
        }, 700);
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
            
            // Clear previous timeout
            clearTimeout(typingTimeout);
            
            // Set new timeout
            typingTimeout = setTimeout(() => {
                socket.emit('stop_typing', {
                    chatId: currentChatId,
                    user: 'user',
                    recipientId: currentAgentId
                });
            }, 1000);
        }
    });

    socket.on('typing', (data) => {
        if (data.user === 'agent' && data.senderId === currentAgentId) {
            showTypingIndicator('Agent is typing...');
        }
    });

    socket.on('stop_typing', (data) => {
        if (data.user === 'agent' && data.senderId === currentAgentId) {
            hideTypingIndicator();
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
}); 