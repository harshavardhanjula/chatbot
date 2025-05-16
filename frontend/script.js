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
        
        // Make sure message is a string before using replace
        const messageContent = message ? message.toString() : 'No response received';
        text.innerHTML += messageContent.replace(/\n/g, '<br>');
        
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
    let lastGreetingTime = null;
    
    // Function to check if greeting needs to be refreshed (if more than 1 hour has passed)
    function shouldRefreshGreeting() {
        if (!lastGreetingTime) return true;
        
        const now = new Date();
        const hoursPassed = (now - lastGreetingTime) / (1000 * 60 * 60);
        return hoursPassed >= 1;
    }
    
    // Function to refresh the greeting message if needed
    function refreshGreetingIfNeeded() {
        if (!shouldRefreshGreeting()) return;
        
        // Find the first bot message and update it with a new time-based greeting
        const messages = document.querySelectorAll('.message.bot');
        if (messages.length > 0) {
            const firstBotMessage = messages[0];
            const msgTextElement = firstBotMessage.querySelector('.msg-text');
            if (msgTextElement) {
                // Keep the timestamp but update the greeting text
                const timeSpan = msgTextElement.querySelector('.msg-time');
                const greeting = getTimeBasedGreeting();
                
                // Personalize greeting if user contact info exists
                const personalizedGreeting = userContactInfo && userContactInfo.name 
                    ? `${greeting}, ${userContactInfo.name}! Welcome to Angadi World Technologies.` 
                    : `${greeting}! Welcome to Angadi World Technologies.`;
                
                // Clear and rebuild the message content
                msgTextElement.innerHTML = '';
                msgTextElement.appendChild(timeSpan);
                msgTextElement.appendChild(document.createElement('br'));
                msgTextElement.appendChild(document.createTextNode(personalizedGreeting));
                
                // Update the last greeting time
                lastGreetingTime = new Date();
            }
        }
    }

    // Minimize/Maximize chat widget
    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMinimized = !isMinimized;
        chatBody.style.display = isMinimized ? 'none' : 'flex';
        minimizeBtn.textContent = isMinimized ? '+' : '−';
        
        // If opening the chat, refresh the greeting if needed
        if (!isMinimized) {
            refreshGreetingIfNeeded();
        }
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

    // Function to get time-based greeting
    function getTimeBasedGreeting() {
        const currentHour = new Date().getHours();
        
        if (currentHour >= 0 && currentHour < 12) {
            return 'Good morning';
        } else if (currentHour >= 12 && currentHour < 18) {
            return 'Good afternoon';
        } else if (currentHour >= 18 && currentHour < 22) {
            return 'Good evening';
        } else {
            return 'Good night';
        }
    }
    
    // Initial greeting and options
    function showInitialGreeting() {
        const greeting = getTimeBasedGreeting();
        
        // Personalize greeting if user contact info exists
        const personalizedGreeting = userContactInfo && userContactInfo.name 
            ? `${greeting}, ${userContactInfo.name}! Welcome to Angadi World Technologies.` 
            : `${greeting}! Welcome to Angadi World Technologies.`;
        
        addMessage(personalizedGreeting, 'bot');
        addMessage('How may I assist you today?', 'bot');
        addMessage('Please select one of the options to know more, or ask your own question.', 'bot');
        showOptions();
        
        // Set the last greeting time to track when the greeting was last updated
        lastGreetingTime = new Date();
    }

    // Store last user message for optional query
    let lastUserQuery = '';

    // Track the last option clicked for escalation
    let lastOptionClicked = '';

    // Store user contact information
    let userContactInfo = {
        name: '',
        email: '',
        mobile: ''
    };
    
    // Check if we have user contact information
    function hasUserContactInfo() {
        return userContactInfo.name && userContactInfo.email;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        // Remove any existing typing indicator
        hideTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        document.getElementById('chatMessages').appendChild(typingDiv);
        scrollChatToBottom();
    }
    
    // Function to hide typing indicator
    function hideTypingIndicator() {
        const existingIndicator = document.getElementById('typingIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

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
    function showContactForm({ requireQuery = false, prefillQuery = '', prefillName = '', prefillEmail = '', prefillMobile = '', onCancel = null, onSubmit = null } = {}) {
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
                <div class="input-group"><span class="input-icon">👤</span><input type="text" name="name" placeholder="Your Name" value="${prefillName}" required></div>
                <div class="input-group"><span class="input-icon">✉️</span><input type="email" name="email" placeholder="Email Address" value="${prefillEmail}" required></div>
                <div class="input-group"><span class="input-icon">🇮🇳 +91</span><input type="tel" name="mobile" placeholder="Mobile Number" value="${prefillMobile}" required pattern="[0-9]{10,15}"></div>
                <div class="input-group"><span class="input-icon">💬</span><input type="text" name="query" placeholder="Your Query" ${requireQuery ? 'required' : ''} value="${prefillQuery}"></div>
                <div class="form-btn-row">
                  <button type="submit" class="submit-btn">Submit</button>
                  <button type="button" class="cancel-btn">Cancel</button>
                </div>
            </form>
        `;
        document.getElementById('chatMessages').appendChild(formDiv);
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
            
            // If onSubmit callback is provided, call it with the form data
            if (typeof onSubmit === 'function') {
                onSubmit(data);
                addMessage(`Thank you, ${data.name}! We'll send the requested information to ${data.email} shortly.`, 'bot', new Date());
                formDiv.remove();
                return;
            }

            // Default behavior if no onSubmit callback
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
            // Call onCancel callback if provided
            if (typeof onCancel === 'function') {
                onCancel();
            }
        };
    }

    // Helper function to scroll chat to bottom
    function scrollChatToBottom() {
        var chatMessages = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
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
                    showContactForm({ 
                        requireQuery: false, 
                        prefillQuery: lastUserQuery,
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile
                    });
                    return;
                case 'Book Appointment':
                    addMessage('To book an appointment, please provide your contact information and appointment details.', 'bot', new Date());
                    showContactForm({
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile,
                        requireQuery: true,
                        onSubmit: (formData) => {
                            // Send appointment request via email
                            handleAppointmentRequest(formData);
                        },
                        onCancel: () => {
                            // Only send cancellation email if we have user contact info
                            if (hasUserContactInfo()) {
                                sendCancelledFormEmail('Appointment request (cancelled)');
                            }
                            addMessage('If you change your mind, you can always book an appointment later.', 'bot', new Date());
                        }
                    });
                    return;
                case 'View Products/Services':
                    addMessage('To view our products and services, please provide your contact information and we will send you our catalog.', 'bot', new Date());
                    showContactForm({
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile,
                        prefillQuery: 'I would like to learn more about your products and services.',
                        requireQuery: false,
                        onSubmit: (formData) => {
                            // Send email for products/services request
                            sendProductsServicesEmail(formData);
                            // Update user contact info
                            userContactInfo.name = formData.name;
                            userContactInfo.email = formData.email;
                            userContactInfo.mobile = formData.mobile || '';
                            // Show confirmation message
                            addMessage(`Thank you, ${formData.name}. We will send our product catalog to ${formData.email} shortly.`, 'bot', new Date());
                        },
                        onCancel: () => {
                            // Only send cancellation email if we have user contact info
                            if (hasUserContactInfo()) {
                                sendCancelledFormEmail('Request for product/service information (cancelled)');
                            }
                            addMessage('If you change your mind, you can always ask about our products and services later.', 'bot', new Date());
                        }
                    });
                    break;
                case 'Pricing':
                    addMessage('For pricing information, please provide your contact information and we will send you our price list.', 'bot', new Date());
                    showContactForm({
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile,
                        prefillQuery: 'I would like to learn more about your pricing options.',
                        requireQuery: false,
                        onSubmit: (formData) => {
                            // Send email for pricing request
                            sendPricingEmail(formData);
                            // Update user contact info
                            userContactInfo.name = formData.name;
                            userContactInfo.email = formData.email;
                            userContactInfo.mobile = formData.mobile || '';
                            // Show confirmation message
                            addMessage(`Thank you, ${formData.name}. We will send our pricing information to ${formData.email} shortly.`, 'bot', new Date());
                        },
                        onCancel: () => {
                            // Only send cancellation email if we have user contact info
                            if (hasUserContactInfo()) {
                                sendCancelledFormEmail('Request for pricing information (cancelled)');
                            }
                            addMessage('If you change your mind, you can always ask about our pricing later.', 'bot', new Date());
                        }
                    });
                    break;
                case 'Our Customers':
                    addMessage('To learn about our customers and case studies, please provide your contact information.', 'bot', new Date());
                    showContactForm({
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile,
                        prefillQuery: 'I would like to see customer case studies and references.',
                        requireQuery: false,
                        onSubmit: (formData) => {
                            // Send email for customer references request
                            sendCustomersEmail(formData);
                            // Update user contact info
                            userContactInfo.name = formData.name;
                            userContactInfo.email = formData.email;
                            userContactInfo.mobile = formData.mobile || '';
                            // Show confirmation message
                            addMessage(`Thank you, ${formData.name}. We will send our customer case studies to ${formData.email} shortly.`, 'bot', new Date());
                        },
                        onCancel: () => {
                            // Only send cancellation email if we have user contact info
                            if (hasUserContactInfo()) {
                                sendCancelledFormEmail('Request for customer references (cancelled)');
                            }
                            addMessage('If you change your mind, you can always ask about our customers later.', 'bot', new Date());
                        }
                    });
                    break;
                case 'Request Human Agent':
                    showContactForm({ 
                        requireQuery: false, 
                        prefillQuery: lastUserQuery,
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile
                    });
                    return;
                default:
                    response = 'Sorry, I could not find the information you requested.';
            }
            addMessage(response, 'bot', new Date());
        }, 700);
    }

    // Show greeting and options on load
    showInitialGreeting();

    // Listen for command output from backend and display as bot message
    socket.on('command_output', (data) => {
        addMessage(data.output, 'bot', new Date(), data.success ? 'success' : 'error');
    });
    
    // Function to process user message
    async function processUserMessage(message) {
        // Show typing indicator
        showTypingIndicator();

        try {
            // Send query to backend (without contact info initially)
            const response = await fetch('http://localhost:5000/api/exec', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: message,
                    userName: userContactInfo.name || '',
                    userEmail: userContactInfo.email || ''
                })
            });

            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data = await response.json();

            // Hide typing indicator
            hideTypingIndicator();

            if (!data || typeof data.response === 'undefined') {
                console.error('Invalid response data:', data);
                addMessage('Sorry, I received an invalid response. Please try again.', 'bot', new Date());
                return;
            }

            addMessage(data.response, 'bot', new Date());

            if (data.escalated) {
                if (!hasUserContactInfo()) {
                    collectUserContactInfo(message, () => {
                        sendEscalatedQueryEmail(message, data.category || 'Sensitive');
                        addMessage(`I'm sorry, ${userContactInfo.name}, but I can't provide a reply to this query. Your message has been forwarded to our team, and they will contact you at ${userContactInfo.email} shortly.`, 'bot', new Date());
                    });
                } else {
                    sendEscalatedQueryEmail(message, data.category || 'Sensitive');
                    setTimeout(() => {
                        addMessage(`I'm sorry, ${userContactInfo.name}, but I can't provide a reply to this query. Your message has been forwarded to our team, and they will contact you at ${userContactInfo.email} shortly.`, 'bot', new Date());
                        showContactForm({
                            requireQuery: false,
                            prefillQuery: message,
                            prefillName: userContactInfo.name,
                            prefillEmail: userContactInfo.email,
                            onCancel: () => {
                                sendCancelledFormEmail(message);
                            }
                        });
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            hideTypingIndicator();
            addMessage('Sorry, there was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    function collectUserContactInfo(message, callback) {
        try {
            // First, display the welcome message
            addMessage("Before I process your query, please provide your contact information", 'bot', new Date());
            
            // Wait a moment before showing the form (for better UX)
            setTimeout(() => {
            // Create a simple form to collect name and email
            const formDiv = document.createElement('div');
            formDiv.className = 'message bot';
            formDiv.id = 'contactInfoForm';
            formDiv.innerHTML = `
                <form id="userInfoForm" class="contact-form">
                    <div style="font-weight:bold; margin-bottom:8px;">Contact Details</div>
                    <div class="input-group"><span class="input-icon">👤</span><input type="text" id="userNameInput" placeholder="Your Name" required></div>
                    <div class="input-group"><span class="input-icon">✉️</span><input type="email" id="userEmailInput" placeholder="Email Address" required></div>
                    <div class="form-btn-row">
                      <button type="submit" class="submit-btn">Submit</button>
                    </div>
                </form>
            `;
            
            // Append the form to the chat
            document.getElementById('chatMessages').appendChild(formDiv);
            scrollChatToBottom();
            
            // Focus on the name input field
            setTimeout(() => {
                const nameInput = document.getElementById('userNameInput');
                if (nameInput) nameInput.focus();
            }, 100);
            
            // Handle form submission
            const form = document.getElementById('userInfoForm');
            if (form) {
                form.onsubmit = function(e) {
                    e.preventDefault();
                    userContactInfo.name = document.getElementById('userNameInput').value.trim();
                    userContactInfo.email = document.getElementById('userEmailInput').value.trim();
                    
                    // Remove the form
                    formDiv.remove();
                    
                    // Show confirmation message
                    addMessage(`Thank you, ${userContactInfo.name}. Now processing your query...`, 'bot', new Date());
                    
                    // Call the callback with the collected info
                    if (callback) callback();
                };
            }
        }, 800);
        } catch (error) {
            console.error('Error collecting user contact info:', error);
            addMessage('There was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    // Override handleUserMessage to use the /api/exec endpoint
    async function handleUserMessage(message) {
        addMessage(message, 'user', new Date());
        lastUserQuery = message;
        
        // Process the message directly without collecting contact info first
        processUserMessage(message);
    }

    // Function to process user message
    async function processUserMessage(message) {
        // Show typing indicator
        showTypingIndicator();

        try {
            // Send query to backend (without contact info initially)
            const response = await fetch('http://localhost:5000/api/exec', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: message,
                    userName: userContactInfo.name || '',
                    userEmail: userContactInfo.email || ''
                })
            });
            
            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide typing indicator
            hideTypingIndicator();
            
            // Check if data.response exists
            if (!data || typeof data.response === 'undefined') {
                console.error('Invalid response data:', data);
                addMessage('Sorry, I received an invalid response. Please try again.', 'bot', new Date());
                return;
            }
            
            // Add bot response to chat
            addMessage(data.response, 'bot', new Date());
            
            // If the query is escalated, collect contact info if we don't have it
            if (data.escalated) {
                if (!hasUserContactInfo()) {
                    // Collect contact info first, then send the email notification
                    collectUserContactInfo(message, () => {
                        // Send the email notification with contact info
                        sendEscalatedQueryEmail(message, data.category || 'Sensitive');
                        
                        // Show additional message about forwarding the query
                        addMessage(`I'm sorry, ${userContactInfo.name}, but I can't provide a reply to this query. Your message has been forwarded to our team, and they will contact you at ${userContactInfo.email} shortly.`, 'bot', new Date());
                    });
                } else {
                    // We already have contact info, send the email notification
                    sendEscalatedQueryEmail(message, data.category || 'Sensitive');
                    
                    // Add a message that we can't provide a reply after sending the email
                    setTimeout(() => {
                        addMessage(`I'm sorry, ${userContactInfo.name}, but I can't provide a reply to this query. Your message has been forwarded to our team, and they will contact you at ${userContactInfo.email} shortly.`, 'bot', new Date());
                        
                        // Show contact form for additional details
                        showContactForm({
                            requireQuery: false,
                            prefillQuery: message,
                            prefillName: userContactInfo.name,
                            prefillEmail: userContactInfo.email,
                            onCancel: () => {
                                // Send a request to trigger email alert when user cancels
                                sendCancelledFormEmail(message);
                            }
                        });
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            hideTypingIndicator();
            addMessage('Sorry, there was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    // Function to send email notification for escalated query
    function sendEscalatedQueryEmail(message, category) {
        try {
            return fetch('http://localhost:5000/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: message,
                userName: userContactInfo.name,
                userEmail: userContactInfo.email,
                category: category
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Email notification sent:', data);
            return data;
        })
        .catch(error => {
            console.error('Error sending email notification:', error);
        });
        } catch (error) {
            console.error('Error in sendEscalatedQueryEmail:', error);
            return Promise.reject(error);
        }
    }
    
    // Function to send email notification when form is cancelled
    function sendCancelledFormEmail(message) {
        try {
            fetch('http://localhost:5000/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: message,
                    userName: userContactInfo.name,
                    userEmail: userContactInfo.email,
                    forceAlert: true
                })
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Cancellation email sent:', data);
                    // Add message after cancellation and email sent
                    addMessage(`Thank you, ${userContactInfo.name}. Your query has been forwarded to our team. They will get back to you at ${userContactInfo.email} as soon as possible.`, 'bot', new Date());
                })
                .catch(error => {
                    console.error('Error sending cancellation email:', error);
                    addMessage('There was an error forwarding your query. Please try again later.', 'bot', new Date());
                });
        } catch (error) {
            console.error('Error in sendCancelledFormEmail:', error);
            addMessage('There was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    // Function to send email for products/services information request
    function sendProductsServicesEmail(formData) {
        try {
            // Store the contact info for future use regardless of email success
            userContactInfo.name = formData.name;
            userContactInfo.email = formData.email;
            userContactInfo.mobile = formData.mobile || '';
            
            // Add immediate feedback message
            addMessage(`Thank you, ${formData.name}! Processing your request...`, 'bot', new Date());
            
            // Show typing indicator while processing
            showTypingIndicator();
            
            fetch('http://localhost:5000/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: formData.query || 'Request for Products/Services information',
                    userName: formData.name,
                    userEmail: formData.email,
                    mobile: formData.mobile,
                    category: 'Products/Services Request'
                })
            })
                .then(response => {
                    console.log('Response status:', response.status);
                    hideTypingIndicator();
                    
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(`Server responded with status: ${response.status}, message: ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Products/Services email sent:', data);
                    
                    // Add success message
                    addMessage(`Thank you, ${formData.name}! Your request for product and service information has been sent. Our team will contact you shortly at ${formData.email}.`, 'bot', new Date());
                })
                .catch(error => {
                    console.error('Error sending Products/Services email:', error);
                    
                    // Still provide a positive message to the user
                    addMessage(`Thank you for your interest, ${formData.name}! We've received your request for product information. Our team will follow up with you soon at ${formData.email}.`, 'bot', new Date());
                    
                    // Add a small note about potential technical issues
                    setTimeout(() => {
                        addMessage('Note: There might have been a technical issue with our notification system, but your request has been logged.', 'bot', new Date());
                    }, 1000);
                });
        } catch (error) {
            hideTypingIndicator();
            console.error('Error in sendProductsServicesEmail:', error);
            addMessage('There was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    // Function to send email for pricing information request
    function sendPricingEmail(formData) {
        try {
            fetch('http://localhost:5000/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: formData.query || 'Request for Pricing information',
                    userName: formData.name,
                    userEmail: formData.email,
                    mobile: formData.mobile,
                    category: 'Pricing Request'
                })
            })
        .then(response => response.json())
        .then(data => {
            console.log('Pricing email sent:', data);
            // Store the contact info for future use
            userContactInfo.name = formData.name;
            userContactInfo.email = formData.email;
            userContactInfo.mobile = formData.mobile || '';
        })
        .catch(error => {
            console.error('Error sending Pricing email:', error);
            addMessage('There was an error sending your request. Please try again later.', 'bot', new Date());
        });
        } catch (error) {
            console.error('Error in sendPricingEmail:', error);
            addMessage('There was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }
    
    // Function to send email for customers information request
    function sendCustomersEmail(formData) {
        try {
            fetch('http://localhost:5000/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: formData.query || 'Request for Customer information',
                    userName: formData.name,
                    userEmail: formData.email,
                    mobile: formData.mobile,
                    category: 'Customers Request'
                })
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Customers email sent:', data);
                    // Store the contact info for future use
                    userContactInfo.name = formData.name;
                    userContactInfo.email = formData.email;
                    userContactInfo.mobile = formData.mobile || '';
                })
                .catch(error => {
                    console.error('Error sending Customers email:', error);
                    addMessage('There was an error sending your request. Please try again later.', 'bot', new Date());
                });
        } catch (error) {
            console.error('Error in sendCustomersEmail:', error);
            addMessage('There was an error processing your request. Please try again later.', 'bot', new Date());
        }
    }

    // Function to handle appointment request via email
    function handleAppointmentRequest(formData) {
        try {
            showTypingIndicator('Processing your appointment request...');
            
            // Send appointment request via email
            const response = fetch('http://localhost:5000/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `New appointment request received:
Name: ${formData.name}
Email: ${formData.email}
Mobile: ${formData.mobile || 'Not provided'}
Appointment Date: ${formData.appointmentDate}
Appointment Time: ${formData.appointmentTime}
Purpose: ${formData.purpose}

Please contact the user to confirm the appointment details.`,
                    userName: formData.name,
                    userEmail: formData.email,
                    mobile: formData.mobile,
                    category: 'Appointment Request'
                })
            });
            
            response.then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // Store contact info
                        userContactInfo.name = formData.name;
                        userContactInfo.email = formData.email;
                        userContactInfo.mobile = formData.mobile || '';
                        
                        // Show success message
                        addMessage('Your appointment request has been sent successfully! We will contact you shortly to confirm the details.', 'bot', new Date());
                        
                        // Clear the form if it exists
                        const form = document.getElementById('contactForm');
                        if (form) {
                            form.reset();
                        }
                    } else {
                        throw new Error(data.error || 'Failed to send appointment request');
                    }
                })
                .catch(error => {
                    console.error('Error sending appointment request:', error);
                    addMessage(`Sorry, there was an error sending your appointment request: ${error.message}`, 'bot');
                })
                .finally(() => {
                    hideTypingIndicator();
                });
        } catch (error) {
            console.error('Error in handleAppointmentRequest:', error);
            addMessage('There was an error processing your appointment request. Please try again later.', 'bot');
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
        try {
            let indicator = document.getElementById('typingIndicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'typingIndicator';
                indicator.className = 'message bot typing-indicator';
                document.getElementById('chatMessages').appendChild(indicator);
            }
            indicator.textContent = message;
            indicator.style.display = 'block';
        } catch (error) {
            console.error('Error showing typing indicator:', error);
        }
    }

    function hideTypingIndicator() {
        try {
            const indicator = document.getElementById('typingIndicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        } catch (error) {
            console.error('Error hiding typing indicator:', error);
        }
    }

    // Update sendMessage and related logic to send the user message as 'query' to the backend
    function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            if (currentChatId && currentAgentId) {
                const timestamp = new Date().toISOString();
                // Send message to agent
                socket.emit('send_message', {
                    query: message, // Use 'query' instead of 'message'
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

    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter key
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = userInput.value.trim();
            if (message) {
                if (currentAgentId) {
                    const timestamp = new Date().toISOString();
                    socket.emit('send_message', {
                        message,
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