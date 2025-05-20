import socket from './socket.js';

document.addEventListener('DOMContentLoaded', () => {
    // Function to clean up response text
    function cleanResponse(text) {
        console.log('Original text:', JSON.stringify(text));
        if (!text) return '';
        
        // First convert to string and clean up whitespace
        let cleaned = text.toString()
            .replace(/\\n/g, ' ')  // Replace newlines with spaces
            .replace(/\\"/g, '"')  // Unescape quotes
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
            
        console.log('After initial cleanup:', JSON.stringify(cleaned));
        
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
            console.log('Not a valid JSON, processing as plain text');
        }
        
        // Try multiple patterns to extract answer
        const patterns = [
            // JSON-like response with "answer" field
            { pattern: /"answer"\s*:\s*"([^"]+)"/i, name: 'json answer field' },
            // JSON-like response with 'response' field
            { pattern: /"response"\s*:\s*"([^"]+)"/i, name: 'json response field' },
            // Plain text with Answer: prefix
            { pattern: /(?:answer|response)\s*:?\s*([^\n]+)/i, name: 'answer prefix' },
            // Text after question mark and Answer:
            { pattern: /[^?]+\?\s*(?:answer|response)\s*:?\s*([^\n]+)/i, name: 'question answer pattern' },
            // Any text after Answer:
            { pattern: /(?:answer|response)\s*:?\s*([\s\S]*)/i, name: 'generic answer pattern' }
        ];
        
        // Try each pattern until one matches
        for (const {pattern, name} of patterns) {
            const match = cleaned.match(pattern);
            if (match && match[1]) {
                console.log(`Matched pattern: ${name}`);
                cleaned = match[1].trim();
                console.log('After pattern match:', JSON.stringify(cleaned));
                break;
            }
        }
        
        // Clean up any remaining JSON escape sequences
        cleaned = cleaned
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
        
        // Remove any remaining leading/trailing quotes or spaces
        cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim();
        
        // Capitalize first letter
        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        
        console.log('Final cleaned text:', JSON.stringify(cleaned));
        return cleaned;
    }

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
        
        // Clean and format the message
        const messageContent = message ? cleanResponse(message.toString()) : 'No response received';
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
            // 'Address', 'About Us', 'Contact Details',
            'Book Appointment',
            // 'View Products/Services', 'Pricing', 'Our Customers',
            'Request Human Agent'
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

    // Enhanced Conversation Context Management
    class ConversationContext {
        constructor() {
            this.currentTopic = null;
            this.userPreferences = {};
            this.previousMessages = [];
            this.userInfo = {};
            this.serviceInquiry = null;
            this.projectDetails = {};
            this.conversationFlow = [];
            this.entities = {};
            this.sentiment = 'neutral';
            this.intent = null;
            this.confidence = 0;
        }

        updateContext(newContext) {
            Object.assign(this, {...this, ...newContext});
            this._trimMessageHistory();
            this._updateConversationFlow();
            return this;
        }

        addMessage(role, content) {
            this.previousMessages.push({role, content, timestamp: new Date()});
            this._trimMessageHistory();
        }

        setIntent(intent, confidence = 0.8) {
            this.intent = intent;
            this.confidence = confidence;
        }

        extractEntities(message) {
            // Basic entity extraction - can be enhanced with NLP
            const entities = {
                services: [],
                technologies: [],
                timeframes: [],
                budgets: [],
                urls: [],
                emails: [],
                phoneNumbers: []
            };

            // Service keywords
            const serviceKeywords = [
                'branding', 'design', 'development', 'marketing', 'seo', 
                'ui/ux', 'mobile app', 'website', 'ecommerce', 'consulting'
            ];

            // Technology keywords
            const techKeywords = [
                'react', 'angular', 'vue', 'node', 'python', 'java', 'php',
                'wordpress', 'shopify', 'aws', 'azure', 'google cloud'
            ];

            // Extract services
            serviceKeywords.forEach(service => {
                if (message.toLowerCase().includes(service)) {
                    entities.services.push(service);
                }
            });


            // Extract technologies
            techKeywords.forEach(tech => {
                if (message.toLowerCase().includes(tech)) {
                    entities.technologies.push(tech);
                }
            });

            // Extract URLs
            entities.urls = message.match(/https?:\/\/[^\s]+/g) || [];
            
            // Extract emails
            entities.emails = message.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g) || [];
            
            // Extract phone numbers (basic pattern)
            entities.phoneNumbers = message.match(/\+?[\d\s-]{10,}/g) || [];

            this.entities = entities;
            return entities;
        }

        _trimMessageHistory() {
            if (this.previousMessages.length > MAX_CONTEXT_MESSAGES) {
                this.previousMessages = this.previousMessages.slice(-MAX_CONTEXT_MESSAGES);
            }
        }

        _updateConversationFlow() {
            if (this.previousMessages.length > 0) {
                const lastMessage = this.previousMessages[this.previousMessages.length - 1];
                this.conversationFlow.push({
                    role: lastMessage.role,
                    timestamp: lastMessage.timestamp,
                    intent: this.intent,
                    entities: this.entities
                });
            }
        }

        getContextSummary() {
            return {
                currentTopic: this.currentTopic,
                intent: this.intent,
                confidence: this.confidence,
                entities: this.entities,
                recentMessages: this.previousMessages
                    .slice(-3)
                    .map(m => `${m.role}: ${m.content}`)
            };
        }
    }

    // Initialize conversation context
    const conversationContext = new ConversationContext();

    // Maximum number of messages to keep in context
    const MAX_CONTEXT_MESSAGES = 10;

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
            <div class="contact-info-row">+91-9110314465</div
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
                  <button type="submit" class="submit-btn" style="background-color: #FF6B00; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Submit</button>
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
                /*
                case 'Address':
                    addMessage('Sy No 83/1, T Hub Foundation, Plot No 1/C, Knowledge City Rd, Silpa Gram Craft Village, Madhapur, Rai Durg, Hyderabad, Telangana 500081', 'bot', new Date());
                    return;
                case 'About Us':
                    addMessage('Angadi World Technologies', 'bot', new Date());
                    addMessage('Angadi World Technologies (AWT) specialises in a comprehensive suite of IT services, including website development, mobile app development, QR code technology solutions, digital marketing strategies, and project consulting to elevate your business.', 'bot', new Date());
                    return;
                case 'Contact Details':
                    addMessage('Call us<br>+91-9110314465', 'bot', new Date());
                    addMessage('Email us<br>info@angadiworldtech.com', 'bot', new Date());
                    showContactForm({ 
                        requireQuery: false, 
                        prefillQuery: lastUserQuery,
                        prefillName: userContactInfo.name,
                        prefillEmail: userContactInfo.email,
                        prefillMobile: userContactInfo.mobile
                    });
                    return;
                */
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
                /*
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
                */
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
    
    // Function to check if message is asking for address using a scoring system
    function isAskingForAddress(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns with different weights
        const patterns = [
            // High confidence patterns (2 points each)
            { pattern: /(what is|what's|whats|where is|where's|wheres) (your|the|ur) (address|location|office|place|branch|hq|headquarters|premises|building|facility|center|centre|store|shop|outlet)/i, weight: 2 },
            { pattern: /(can you|could you|would you|pls|please) (please )?(provide|give|share|send|tell|text|dm|pm) (me )?(your|the|ur) (address|location|directions|whereabouts|pin|pincode|zip code|map)/i, weight: 2 },
            { pattern: /(how|where|when) (do i|can i|to|should i|would i|will i) (find|get to|reach|locate|visit|see|meet at) (your|the) (office|location|address|place|branch|hq|store|shop)/i, weight: 2 },
            { pattern: /(i need|i want|looking for|seeking|require|i'm looking|i am looking) (the|your|a|an) (address|location|directions|way to|map of) (to )?(your|the) (place|office|location|address)/i, weight: 2 },
            { pattern: /(where (are you|is your|are your|can i find your|do you have an?)|your (location|whereabouts|address|office location|place of business))/i, weight: 2 },
            { pattern: /(show me|send me|give me|i need) (the|your) (address|location|map|directions|pin code|zip code)/i, weight: 2 },
            { pattern: /(what('s| is) (the )?(exact )?(physical )?location (of|for) (your|the)|where exactly (is|are) (you|your))/i, weight: 2 },
            { pattern: /(i('m| am) (trying to|looking to|planning to) (visit|come to|find|locate|reach)|i('d like| would like) to (visit|come to|find|locate|reach))/i, weight: 2 },
            
            // Medium confidence patterns (1 point each)
            { pattern: /(address|location|office|place|branch|hq|headquarters|premises|building|facility|center|centre|store|shop|outlet)( details| information| info| no\.?| #)?/i, weight: 1 },
            { pattern: /(find|locate|reach|get to|visit|see|meet at|navigate to|go to|drive to) (your|the) (office|location|address|place|branch|hq|store|shop|premises)/i, weight: 1 },
            { pattern: /(physical )?(address|location|office|place|building)( of (your|the) (company|business|organization|firm|enterprise))?/i, weight: 1 },
            { pattern: /(what is|what's|whats) (your|the) (business|company|organization)('s)? (address|location|office|place|whereabouts)/i, weight: 1 },
            { pattern: /(can i|how to|what's the best way to) (visit|come to|find|locate|reach|get to) (your|the) (office|location|address|place|branch|hq)/i, weight: 1 },
            { pattern: /(i need|i want|i'd like) (to know|information on|details about) (your|the) (address|location|where (you|your office) (is|are)|where to find you)/i, weight: 1 },
            { pattern: /(are you|is your office|is the office) (located|situated|based) (in|at|on|near) (.*?)(\?|$)/i, weight: 1 },
            { pattern: /(what('s| is) (the )?(nearest|closest) (landmark|metro station|bus stop|train station|airport) (to|near) (your|the) (office|location))/i, weight: 1 },
            
            // Common phrases (0.5 points each)
            { pattern: /(where (are|is|can|could)|how to get|directions to|map of|google maps|waze|gps coordinates|latitude|longitude)/i, weight: 0.5 },
            { pattern: /(business|company|office|corporate|organization)('s)? (address|location|place|premises|building|head office|registered office|corporate office)/i, weight: 0.5 },
            { pattern: /(visit|meet|see|drop by|stop by|come by|swing by) (us|you|at your office|in person|at the office|at your location|at your place)/i, weight: 0.5 },
            { pattern: /(what('s| is) (the )?(full )?(postal )?address|where do you operate from|where are you based|where is this place)/i, weight: 0.5 },
            { pattern: /(i'm|i am|i'll be|i will be) (in|visiting|coming to|going to|traveling to|travelling to) (.*?) (and|,) (would like to|want to|wanted to) (visit|see|meet at|drop by)/i, weight: 0.5 },
            { pattern: /(parking available|parking space|public transport|metro station|bus stop|train station|landmark|nearby hotels|how far from)/i, weight: 0.25 }
        ];
        
        // Calculate score based on matching patterns
        patterns.forEach(({ pattern, weight }) => {
            if (pattern.test(lowerMessage)) {
                score += weight;
            }
        });
        
        // Adjust score based on message length
        const wordCount = lowerMessage.split(/\s+/).length;
        const lengthAdjustment = Math.max(0, 1 - (wordCount * 0.1));
        const finalScore = score * (0.8 + (lengthAdjustment * 0.4));
        
        console.log(`Address detection - Message: "${message}", Score: ${finalScore.toFixed(2)}`);
        
        return finalScore >= 1.5;
    }

    // Function to check if message is asking about QR code technology
    function isAskingAboutQRCode(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns with different weights
        const patterns = [
            // High confidence patterns (2 points each)
            { pattern: /(what|how) (is|are|does) (qr|quick response) (code|technology)/i, weight: 2 },
            { pattern: /(tell me|explain|what do you know) about (qr|quick response) (code|technology)/i, weight: 2 },
            { pattern: /(qr|quick response) code (technology|services|solutions)/i, weight: 2 },
            { pattern: /how (do|can) (qr|quick response) codes? work/i, weight: 2 },
            { pattern: /benefits? of (using )?(qr|quick response) codes?/i, weight: 2 },
            { pattern: /(qr|quick response) code (reader|scanner|technology)/i, weight: 2 },
            { pattern: /(custom|dynamic) qr code/i, weight: 2 },
            { pattern: /qr code (marketing|advertising|campaign)/i, weight: 2 },
            
            // Medium confidence patterns (1 point each)
            { pattern: /(qr|quick response) code/i, weight: 1 },
            { pattern: /scan(ning)? (a )?qr code/i, weight: 1 },
            { pattern: /generate (a )?qr code/i, weight: 1 },
            { pattern: /(business|marketing|restaurant|retail) (use|application) of qr codes?/i, weight: 1 },
            { pattern: /(qr code) (for|in) (business|marketing|retail|hospitality|restaurant|food)/i, weight: 1 },
            { pattern: /(qr code) (generator|creator|builder|designer)/i, weight: 1 },
            { pattern: /(contactless|digital) (menu|payment|ordering)/i, weight: 1 },
            { pattern: /(qr code) (analytics|tracking|statistics)/i, weight: 1 },
            
            // Common phrases (0.5 points each)
            { pattern: /digital menu|contactless|touchless/i, weight: 0.5 },
            { pattern: /mobile payment|digital payment/i, weight: 0.5 },
            { pattern: /barcode|2d code|matrix code/i, weight: 0.5 },
            { pattern: /(qr code) (for|in) (poster|flyer|brochure|business card)/i, weight: 0.5 },
            { pattern: /(qr code) (for|in) (product|packaging|label)/i, weight: 0.5 },
            { pattern: /(qr code) (for|in) (event|conference|exhibition)/i, weight: 0.5 },
            { pattern: /(qr code) (for|in) (real estate|property|construction)/i, weight: 0.5 },
            { pattern: /(qr code) (for|in) (healthcare|medical|hospital)/i, weight: 0.5 }
        ];
        
        // Calculate score based on matching patterns
        patterns.forEach(({ pattern, weight }) => {
            if (pattern.test(lowerMessage)) {
                score += weight;
            }
        });
        
        // Adjust score based on message length
        const wordCount = lowerMessage.split(/\s+/).length;
        const lengthAdjustment = Math.max(0, 1 - (wordCount * 0.1));
        const finalScore = score * (0.8 + (lengthAdjustment * 0.4));
        
        console.log(`QR Code detection - Message: "${message}", Score: ${finalScore.toFixed(2)}`);
        
        return finalScore >= 1.5;
    }
    
    // Function to provide comprehensive information about QR code technology
    function showQRCodeInfo() {
        const response = `🔍 *QR Code Technology Solutions* 🔍

*Our QR Code Technology*
Our advanced QR code reader technology stores URLs, contact details, or text for marketing materials like posters and business cards, providing quick access to information. We create custom QR codes tailored to your specific business needs.

*How QR Codes Drive Business Growth*
• Generate leads and increase customer engagement
• Provide instant access to digital content and promotions
• Enhance marketing campaigns with trackable results
• Enable seamless customer interactions
• Reduce physical contact in the post-pandemic world

*Our QR Code Services*

🚀 *Custom QR Code Generation*
• Static and dynamic QR codes
• Branded QR codes with your logo and colors
• High-resolution QR codes for print materials
• Custom shapes and design elements

📊 *QR Code Analytics & Tracking*
• Real-time scan tracking
• Geographic location of scans
• Device and browser analytics
• Campaign performance reports
• UTM parameter support

🔐 *Secure QR Solutions*
• Password-protected QR codes
• Expiration date settings
• Scan limit controls
• Secure payment QR codes
• Encrypted data storage

*Industry-Specific Solutions*

🍽️ *Restaurants & Food Service*
• Digital menus with real-time updates
• Contactless ordering and payment
• Table ordering via QR codes
• Customer feedback collection
• Loyalty program integration

🛍️ *Retail & E-commerce*
• Product information and reviews
• Exclusive QR code discounts
• Virtual try-on experiences
• Social media integration
• Customer support access

🏥 *Healthcare & Medical*
• Patient information access
• Prescription QR codes
• Medical record access
• Appointment scheduling
• Health and safety information

🏢 *Real Estate & Property*
• Virtual property tours
• Digital brochures and listings
• Contact information access
• Mortgage calculator links
• Neighborhood information

*Implementation Process*
1. *Consultation* - We discuss your specific needs and goals
2. *Strategy* - Develop a customized QR code solution
3. *Design* - Create branded, scannable QR codes
4. *Integration* - Implement across your marketing channels
5. *Analytics* - Track performance and optimize

*Why Choose Our QR Code Solutions?*
• Mobile-optimized for all devices
• Cloud-based management dashboard
• Unlimited scans and redirections
• 99.9% uptime guarantee
• Dedicated support team

Would you like to discuss how QR codes can specifically benefit your business?`;
        
        // Add the message with a slight delay to simulate typing
        setTimeout(() => {
            addMessage(response, 'bot', new Date());
            // Add quick reply buttons
            const quickReplies = document.createElement('div');
            quickReplies.className = 'quick-replies';
            
            const options = [
                'Get a Quote',
                'See Examples',
                'Schedule Demo',
                'Contact Sales'
            ];
            
            options.forEach(option => {
                const btn = document.createElement('button');
                btn.className = 'quick-reply-btn';
                btn.textContent = option;
                btn.onclick = () => handleQuickReply(option);
                quickReplies.appendChild(btn);
            });
            
            document.getElementById('chatMessages').appendChild(quickReplies);
            document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
        }, 800);
    }
    
    // Handle quick reply button clicks
    function handleQuickReply(option) {
        const userMessage = option;
        addMessage(userMessage, 'user', new Date());
        
        // Remove all quick reply buttons
        document.querySelectorAll('.quick-replies').forEach(el => el.remove());
        
        // Process the quick reply
        setTimeout(() => {
            if (option === 'Get a Quote') {
                addMessage('To get a customized quote for QR code solutions, please provide some details about your requirements. What industry are you in?', 'bot', new Date());
            } else if (option === 'See Examples') {
                addMessage('Here are some examples of our QR code implementations:', 'bot', new Date());
                // Add example images or links here
            } else if (option === 'Schedule Demo') {
                addMessage('I can help you schedule a demo of our QR code solutions. What day and time works best for you?', 'bot', new Date());
            } else if (option === 'Contact Sales') {
                showContactDetails();
            }
        }, 500);
    }

    // Function to check if message is asking about services/solutions
    function isAskingAboutServices(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns with different weights
        const patterns = [
            // High confidence patterns (2 points each)
            { pattern: /what (services|solutions) (do you offer|can you provide)/i, weight: 2 },
            { pattern: /(tell me|show me|what are) your (services|solutions|offerings)/i, weight: 2 },
            { pattern: /(digital transformation|branding|design|development) services?/i, weight: 2 },
            { pattern: /(UI\/?UX|user experience|user interface) (design|services)/i, weight: 2 },
            { pattern: /(cloud|consulting|strategy) services?/i, weight: 2 },
            
            // Medium confidence patterns (1 point each)
            { pattern: /(services|solutions)/i, weight: 1 },
            { pattern: /(digital|online) (services|solutions)/i, weight: 1 },
            { pattern: /(brand|design|development|consulting)/i, weight: 1 },
            { pattern: /what (can|do) you (do|offer)/i, weight: 1 },
            { pattern: /(your|the) (work|portfolio|projects)/i, weight: 1 },
            
            // Common phrases (0.5 points each)
            { pattern: /website|app|application|software/i, weight: 0.5 },
            { pattern: /graphic|logo|branding|identity/i, weight: 0.5 },
            { pattern: /strategy|consulting|planning/i, weight: 0.5 }
        ];
        
        // Calculate score based on matching patterns
        patterns.forEach(({ pattern, weight }) => {
            if (pattern.test(lowerMessage)) {
                score += weight;
            }
        });
        
        // Adjust score based on message length
        const wordCount = lowerMessage.split(/\s+/).length;
        const lengthAdjustment = Math.max(0, 1 - (wordCount * 0.1));
        const finalScore = score * (0.8 + (lengthAdjustment * 0.4));
        
        console.log(`Services detection - Message: "${message}", Score: ${finalScore.toFixed(2)}`);
        
        return finalScore >= 1.5;
    }
    
    // Function to provide information about services and solutions
    function showServicesInfo() {
        const response = `🚀 *Our Comprehensive Solutions & Services* 🚀

*Strategic Branding & Design*
• Brand Identity Development
• Logo & Visual Identity Design
• Marketing Collateral
• Packaging Design
• Brand Guidelines

*Digital Transformation*
• Digital Strategy Consulting
• Cloud Solutions & Migration
• Enterprise Software Development
• Digital Process Automation
• IT Infrastructure Management

*UI/UX Design Services*
• User Research & Analysis
• Wireframing & Prototyping
• Responsive Web Design
• Mobile App Design
• User Testing & Optimization

*Development Solutions*
• Custom Web Applications
• Mobile App Development
• E-commerce Solutions
• CMS Development
• API Integration

*Why Choose Our Services?*
• User-Centric Approach
• Creative & Innovative Solutions
• Industry Best Practices
• Timely Project Delivery
• Dedicated Support Team

Would you like more details about any specific service or to discuss your project requirements?`;
        
        // Add the message with a slight delay to simulate typing
        setTimeout(() => {
            addMessage(response, 'bot', new Date());
            
            // Add quick reply buttons
            const quickReplies = document.createElement('div');
            quickReplies.className = 'quick-replies';
            
            const options = [
                'Branding Services',
                'UI/UX Design',
                'Development',
                'Get a Quote'
            ];
            
            options.forEach(option => {
                const btn = document.createElement('button');
                btn.className = 'quick-reply-btn';
                btn.textContent = option;
                btn.onclick = () => handleServiceQuickReply(option);
                quickReplies.appendChild(btn);
            });
            
            document.getElementById('chatMessages').appendChild(quickReplies);
            document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
        }, 800);
    }
    
    // Handle service-related quick reply button clicks
    function handleServiceQuickReply(option) {
        const userMessage = option;
        addMessage(userMessage, 'user', new Date());
        
        // Remove all quick reply buttons
        document.querySelectorAll('.quick-replies').forEach(el => el.remove());
        
        // Process the quick reply
        setTimeout(() => {
            let response = '';
            
            switch(option) {
                case 'Branding Services':
                    response = `🎨 *Branding Services* 🎨

Our branding services help you create a strong, memorable identity that resonates with your target audience:

• *Brand Strategy*: Develop a unique brand positioning
• *Logo Design*: Create a distinctive visual identity
• *Brand Guidelines*: Ensure consistent brand representation
• *Marketing Collateral*: Business cards, letterheads, and more
• *Brand Refresh*: Update and modernize existing brands

Would you like to see some of our branding work or discuss a project?`;
                    break;
                    
                case 'UI/UX Design':
                    response = `✨ *UI/UX Design Services* ✨

We create intuitive, user-centered digital experiences that drive engagement and conversions:

• *User Research*: Understand your audience's needs
• *Wireframing & Prototyping*: Test and refine concepts
• *UI Design*: Beautiful, functional interfaces
• *Mobile-First Approach*: Optimized for all devices
• *Usability Testing*: Ensure optimal user experience

Would you like to discuss your UI/UX project requirements?`;
                    break;
                    
                case 'Development':
                    response = `💻 *Development Solutions* 💻

Custom development solutions tailored to your business needs:

• *Web Development*: Responsive, scalable websites
• *Mobile Apps*: iOS & Android applications
• *E-commerce*: Online stores with secure payment
• *Custom Software*: Business process automation
• *API Integration*: Connect your systems

What type of development project do you have in mind?`;
                    break;
                    
                case 'Get a Quote':
                    response = `📝 *Get a Custom Quote* 📝

To provide you with an accurate quote, I'll need a few details about your project:

1. What type of service are you interested in?
2. What are your main goals/objectives?
3. Do you have a timeline or deadline?
4. What is your estimated budget range?

Please share these details, and I'll prepare a customized proposal for you.`;
                    break;
            }
            
            addMessage(response, 'bot', new Date());
        }, 500);
    }

    // Function to check if message is asking about the company using a scoring system
    function isAskingAboutCompany(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns with different weights
        const patterns = [
            // High confidence patterns (2 points each)
            { pattern: /(what|who|when|where|why|how) (is|are|was|were|does|do|did|has|have|had) (your|the|ur) (company|business|organization|firm|enterprise|startup|venture|operation|establishment)/i, weight: 2 },
            { pattern: /(tell me|can you tell me|could you tell me|please tell me|i'd like to know) (about|more about|all about|something about|details about) (your|the) (company|business|organization)/i, weight: 2 },
            { pattern: /(what|how) (does|do|is|are) (your|the) (company|business|organization) (do|offer|provide|sell|make|create|develop|produce|specialize in|focus on|deal with)/i, weight: 2 },
            { pattern: /(i would like|i want|i need|i'm looking for|i am looking for|i'm interested in|i am interested in) (to know|information|details|to learn|to understand) (about|regarding|concerning) (your|the) (company|business|organization)/i, weight: 2 },
            { pattern: /(can you|could you|would you|will you|please) (please )?(tell|explain|describe|share|provide|give) (me )?(about|what is|what's|who is|who's) (your|the) (company|business|organization)/i, weight: 2 },
            { pattern: /(what('s| is) (the )?(story|background|history|origin) (behind|of|about) (your|the) (company|business|organization))/i, weight: 2 },
            { pattern: /(who (are you|r u)|what (are you|do you do)|tell me about yourself|introduce your company)/i, weight: 2 },
            { pattern: /(i('m| am) (researching|studying|analyzing|evaluating) (your|the) (company|business|organization) (for|because)|i need info (on|about) your (company|business|organization))/i, weight: 2 },
            
            // Medium confidence patterns (1 point each)
            { pattern: /(about us|about company|about the company|our story|our mission|our vision|our values|who we are|what we do|our team|our history|our background|our journey)/i, weight: 1 },
            { pattern: /(what|how) (is|are) (your|the) (company|business|organization) (all about|like|different|unique|special|positioned|structured)/i, weight: 1 },
            { pattern: /(tell me|describe|explain|share|provide) (me )?(with )?(details|information|an overview|a summary) (about|of|on) (your|the) (company|business|organization)/i, weight: 1 },
            { pattern: /(what|which) (kind of|type of|sort of) (company|business|organization) (are you|is this|do you run|do you own)/i, weight: 1 },
            { pattern: /(i'm|i am|i've been) (interested in|curious about|researching|studying|analyzing|evaluating|considering|looking at) (your|the) (company|business|organization)/i, weight: 1 },
            { pattern: /(can you|could you) (give|provide|share) (me )?(some|any) (information|details|background) (about|on|regarding) (your|the) (company|business|organization)/i, weight: 1 },
            { pattern: /(what|which) (products|services|solutions) (does|do) (your|the) (company|business|organization) (offer|provide|sell|develop|create)/i, weight: 1 },
            { pattern: /(how long|since when|when did) (has|have|did) (your|the) (company|business|organization) (been|existed|operated|started|been around)/i, weight: 1 },
            
            // Common phrases (0.5 points each)
            { pattern: /(company|business|organization|firm|enterprise) (profile|information|details|background|history|overview|summary|description|introduction|at a glance)/i, weight: 0.5 },
            { pattern: /(what|tell me) (do you do|does your company do|is your business|is your organization about|services do you offer|products do you sell)/i, weight: 0.5 },
            { pattern: /(can you|could you|would you) (tell|explain|describe|share) (me )?(about|what) (you do|your company does|your business does|your organization does)/i, weight: 0.5 },
            { pattern: /(i'd like|i would like|i need|i want) (to know|information|details|to learn|to understand) (about|on|regarding) (your|the) (company|business|organization)/i, weight: 0.5 },
            { pattern: /(what('s| is) (the )?(nature|focus|specialty|specialization|niche|core) (of|for) (your|the) (business|company|organization))/i, weight: 0.5 },
            { pattern: /(are you|is this|is your company) (a|an) (startup|small business|medium enterprise|large corporation|multinational|local business|family business|sme|msme)/i, weight: 0.5 },
            { pattern: /(what (industry|sector|field|domain|market) (are you in|do you operate in|does your company serve))/i, weight: 0.25 }
        ];
        
        // Calculate score based on matching patterns
        patterns.forEach(({ pattern, weight }) => {
            if (pattern.test(lowerMessage)) {
                score += weight;
            }
        });
        
        // Adjust score based on message length
        const wordCount = lowerMessage.split(/\s+/).length;
        const lengthAdjustment = Math.max(0, 1 - (wordCount * 0.1));
        const finalScore = score * (0.8 + (lengthAdjustment * 0.4));
        
        console.log(`Company detection - Message: "${message}", Score: ${finalScore.toFixed(2)}`);
        
        return finalScore >= 1.5;
    }

    // Function to check if message is asking about design tools or development technologies
    function isAskingAboutTechStack(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns for design tools
        const designTools = [
            'figma', 'adobe xd', 'sketch', 'invision studio', 'photoshop', 
            'illustrator', 'canva', 'maze', 'adobe photoshop', 'adobe illustrator',
            'ui design', 'ux design', 'prototyping', 'wireframing', 'mockup'
        ];
        
        // Define patterns for development technologies
        const devTechnologies = [
            'react', 'angular', 'vue', 'javascript', 'typescript', 'node.js', 'express',
            'mongodb', 'mysql', 'postgresql', 'firebase', 'aws', 'azure', 'docker',
            'kubernetes', 'react native', 'flutter', 'swift', 'kotlin', 'java', 'python',
            'django', 'flask', 'php', 'laravel', 'wordpress', 'shopify', 'web development',
            'mobile development', 'app development', 'frontend', 'backend', 'full stack'
        ];
        
        // Check for design tools
        const designToolMatch = designTools.some(tool => 
            new RegExp(`\\b${tool}\\b`, 'i').test(lowerMessage)
        );
        
        // Check for development technologies
        const devTechMatch = devTechnologies.some(tech => 
            new RegExp(`\\b${tech}\\b`, 'i').test(lowerMessage)
        );
        
        // Check for general tech stack questions
        const generalTechQuestions = [
            /what(?:'s| is) your (?:tech stack|technology stack|stack|tech)/i,
            /which (?:technologies|tools|frameworks|languages) (?:do you|are you) use(?:d|s)?/i,
            /how (?:is|was) (?:this|the) (?:app|website|platform) (?:built|developed|created)/i,
            /what (?:technologies|tools|frameworks) (?:are|were) used (?:to build|for|in)/i,
            /(?:tech|technology) stack (?:used|utilized|for|in)/i
        ];
        
        // Calculate score
        if (designToolMatch) score += 1.5;
        if (devTechMatch) score += 1.5;
        
        // Add score for general tech questions
        generalTechQuestions.forEach(pattern => {
            if (pattern.test(lowerMessage)) {
                score += 2;
            }
        });
        
        // Add score for specific tech stack questions
        if (/(?:website|web app|mobile app|application) (?:tech|technology|stack|built with|developed with)/i.test(lowerMessage)) {
            score += 2;
        }
        
        console.log(`Tech stack detection - Message: "${message}", Score: ${score.toFixed(2)}`);
        
        return score >= 1.5;
    }
    
    // Function to provide information about design tools and tech stack
    function showTechStackInfo() {
        const response = `🚀 *Technologies We Use* 🚀

*Design & Prototyping:*
• Figma - For UI/UX design and prototyping
• Adobe XD - For interactive design and prototyping
• Sketch - For digital design and wireframing
• InVision Studio - For advanced prototyping
• Adobe Photoshop - For image editing and graphics
• Adobe Illustrator - For vector graphics and illustrations
• Canva - For quick designs and social media graphics
• Maze - For user testing and research

*Development Technologies:*
• Frontend: React.js, Vue.js, Angular
• Mobile: React Native, Flutter, Swift, Kotlin
• Backend: Node.js, Python (Django/Flask), PHP (Laravel)
• Databases: MongoDB, MySQL, PostgreSQL
• Cloud & DevOps: AWS, Azure, Docker, Kubernetes
• CMS: WordPress, Shopify, Custom Solutions

Would you like more details about any specific technology or tool?`;
        
        addMessage(response, 'bot', new Date());
    }

    // Function to check if message is asking for contact details using a scoring system
    function isAskingForContactDetails(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        // Define patterns with different weights
        const patterns = [
            // High confidence patterns (2 points each)
            { pattern: /(what is|what's|whats|wats) (your|ur|the) (phone|mobile|number|email|contact|e-?mail|telephone)/i, weight: 2 },
            { pattern: /(how|where|when) (can i|do i|to|should i) (contact|reach|get in touch|find|speak to|talk to|call|email|text|message)/i, weight: 2 },
            { pattern: /(provide|give|share|send|dm|pm) (me )?(your|the|ur) (contact|phone|email|number|e-?mail|whatsapp|telegram|signal)/i, weight: 2 },
            { pattern: /(i need|i want|looking for|seeking|require) (to )?(contact|reach|get in touch|speak to|talk to|call|email|text|message)/i, weight: 2 },
            { pattern: /(can you|could you|would you) (please )?(provide|give|share|send) (me )?(your|the) (contact|phone|email|number)/i, weight: 2 },
            
            // Medium confidence patterns (1 point each)
            { pattern: /(phone|mobile|cell|number|contact|e-?mail|whatsapp|telegram|signal)( details| information| info| no\.?| num(ber)?)?/i, weight: 1 },
            { pattern: /(reach|contact|get in touch|connect|message|text|call|ring|dial|email)/i, weight: 1 },
            { pattern: /(business|company|organization|firm|office)( email| phone| contact| number| e-?mail)?/i, weight: 1 },
            { pattern: /(support|help|assistance|customer service|tech support|helpdesk|help desk)( contact| email| phone| number)?/i, weight: 1 },
            { pattern: /(sales|marketing|technical|billing|accounts)( team| department| dept\.?)?( contact| email| phone)?/i, weight: 1 },
            
            // Common phrases (1 point each)
            { pattern: /(contact (details|information|info|number|e-?mail|phone)|phone number|mobile number|e-?mail (address|id|id:?)|whatsapp number|telegram id)/i, weight: 1 },
            { pattern: /(reach out|get hold of|get ahold of|get in contact|speak with|talk with|chat with|connect with|drop a line|give a call|give a ring)/i, weight: 1 },
            { pattern: /(how (do|can) i (get|be) in touch|best way to contact|preferred method of contact|how to reach out)/i, weight: 1 },
            
            // Question patterns (1 point each)
            { pattern: /(what is|what's|whats|wats|where is|where's|wheres|how to|how do i) (find|get|obtain|see|view) (your|the) (contact|phone|email|number|details|information)/i, weight: 1 },
            { pattern: /(can|could|would|may|might|will|shall) (i|you|we) (have|get|obtain|receive) (your|the) (contact|phone|email|number|details|information)/i, weight: 1 },
            { pattern: /(is there|do you have|can i get|where can i find) (a|the|your) (contact|phone|email|number|details|information)/i, weight: 1 },
            
            // Common misspellings and variations (0.5 points each)
            { pattern: /(contect|e-?mail|e ?mail|e-?mail|e-post|e post|telephone|tel\.?|whatsapp|watsapp|signal|telegram|viber|skype|messenger)/i, weight: 0.5 },
            { pattern: /(mob(ile)?|cell(ular)?|phone|fone|telephone|tel\.?|whatsapp|signal|telegram|viber|skype|messenger)( no\.?| num(ber)?| #)?/i, weight: 0.5 },
            
            // Contextual patterns (0.5 points each)
            { pattern: /(when|where|how) (to|can i|should i|do i|would i|will i) (contact|reach|get in touch|speak to|talk to|call|email|text|message)/i, weight: 0.5 },
            { pattern: /(i('m| am) (trying|looking|attempting|wanting)) (to )?(contact|reach|get in touch|speak to|talk to|call|email|text|message)/i, weight: 0.5 },
            { pattern: /(need|want|require|looking for|seeking) (to )?(contact|reach|get in touch|speak to|talk to|call|email|text|message)/i, weight: 0.5 }
        ];
        
        // Calculate score based on matching patterns
        patterns.forEach(({ pattern, weight }) => {
            if (pattern.test(lowerMessage)) {
                score += weight;
            }
        });
        
        // Adjust score based on message length (shorter messages need higher confidence)
        const wordCount = lowerMessage.split(/\s+/).length;
        const lengthAdjustment = Math.max(0, 1 - (wordCount * 0.1)); // Reduce score for longer messages
        
        // Final score with adjustment (threshold of 1.5 works well in testing)
        const finalScore = score * (0.8 + (lengthAdjustment * 0.4));
        
        // Debug logging (can be removed in production)
        console.log(`Contact detection - Message: "${message}", Score: ${finalScore.toFixed(2)}`);
        
        return finalScore >= 1.5;
    }

    // Function to show contact details
    function showContactDetails() {
        addMessage('For assistance:', 'bot', new Date());
        addMessage('Email: info@angadiworldtech.com', 'bot', new Date());
        addMessage('Phone: +91-9110314465', 'bot', new Date());
    }

    // Enhanced NLU Processor
    class NLUProcessor {
        constructor() {
            this.intents = {
                greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
                goodbye: ['bye', 'goodbye', 'see you', 'talk later', 'thanks, bye'],
                services: ['services', 'solutions', 'offerings', 'what do you do', 'what can you do'],
                pricing: ['price', 'cost', 'how much', 'pricing', 'budget'],
                contact: ['contact', 'email', 'phone', 'call', 'speak to someone'],
                help: ['help', 'support', 'assistance', 'can you help'],
                appointment: ['schedule', 'meeting', 'appointment', 'book a call'],
                portfolio: ['portfolio', 'work', 'projects', 'show me examples', 'case studies']
            };
            
            this.entities = {
                serviceType: ['website', 'app', 'mobile', 'design', 'development', 'marketing', 'seo', 'branding'],
                timeframe: ['asap', 'urgent', 'immediately', 'next week', 'next month', 'in a month', 'in 2 weeks'],
                priority: ['urgent', 'high', 'medium', 'low', 'not urgent'],
                budget: ['$', 'dollar', 'euro', 'inr', 'rupee', 'budget', 'cost', 'price']
            };
        }

        detectIntent(message) {
            const lowerMessage = message.toLowerCase();
            let detectedIntent = 'unknown';
            let confidence = 0;
            let matchedPattern = '';

            // Check for exact matches first
            for (const [intent, patterns] of Object.entries(this.intents)) {
                for (const pattern of patterns) {
                    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
                    if (regex.test(lowerMessage)) {
                        detectedIntent = intent;
                        confidence = 0.9; // High confidence for exact matches
                        matchedPattern = pattern;
                        break;
                    }
                }
                if (detectedIntent !== 'unknown') break;
            }

            // If no exact match, check for partial matches
            if (detectedIntent === 'unknown') {
                for (const [intent, patterns] of Object.entries(this.intents)) {
                    for (const pattern of patterns) {
                        if (lowerMessage.includes(pattern)) {
                            detectedIntent = intent;
                            confidence = 0.7; // Medium confidence for partial matches
                            matchedPattern = pattern;
                            break;
                        }
                    }
                    if (detectedIntent !== 'unknown') break;
                }
            }

            return {
                intent: detectedIntent,
                confidence,
                matchedPattern,
                timestamp: new Date().toISOString()
            };
        }

        extractEntities(message) {
            const entities = {};
            const lowerMessage = message.toLowerCase();

            // Extract service types
            entities.serviceTypes = this.entities.serviceType.filter(
                service => new RegExp(`\\b${service}\\b`, 'i').test(lowerMessage)
            );

            // Extract timeframes
            entities.timeframes = this.entities.timeframe.filter(
                time => lowerMessage.includes(time)
            );

            // Extract priority
            entities.priority = this.entities.priority.find(
                p => new RegExp(`\\b${p}\\b`, 'i').test(lowerMessage)
            ) || 'medium';

            // Extract budget (simple regex for numbers with currency symbols)
            const budgetMatch = lowerMessage.match(/(?:\$|€|£|₹|¥|\b(?:usd|eur|gbp|inr|jpy|aed)\b)?\s*\d+[\d,.]*/gi) || [];
            entities.budgets = budgetMatch.map(b => b.trim());

            // Extract contact information
            entities.emails = lowerMessage.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
            entities.phones = lowerMessage.match(/\+?[\d\s-]{10,}/g) || [];

            return entities;
        }

        analyzeSentiment(message) {
            // Simple sentiment analysis
            const positiveWords = ['great', 'good', 'excellent', 'amazing', 'love', 'like', 'perfect', 'wonderful', 'happy', 'pleased'];
            const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'poor', 'worst', 'angry', 'upset', 'disappointed'];
            
            const lowerMessage = message.toLowerCase();
            let score = 0;
            
            positiveWords.forEach(word => {
                if (new RegExp(`\\b${word}\\b`).test(lowerMessage)) score++;
            });
            
            negativeWords.forEach(word => {
                if (new RegExp(`\\b${word}\\b`).test(lowerMessage)) score--;
            });
            
            return {
                score,
                sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
            };
        }
    }

    // Initialize NLU Processor
    const nlu = new NLUProcessor();

    // Enhanced Response Generator
    class ResponseGenerator {
        constructor() {
            this.responses = {
                greeting: [
                    "Hello! How can I assist you today?",
                    "Hi there! What can I help you with?",
                    "Welcome! How may I be of service?"
                ],
                goodbye: [
                    "Goodbye! Feel free to return if you have more questions.",
                    "Thanks for chatting! Have a great day!",
                    "See you later! Let us know if you need anything else."
                ],
                services: {
                    default: "We offer a wide range of services including web development, mobile apps, UI/UX design, and digital marketing. Which area are you interested in?",
                    web: "Our web development services include responsive websites, e-commerce solutions, and web applications. We use modern technologies like React, Angular, and Node.js. Would you like to know more about our web development services?",
                    mobile: "We develop cross-platform mobile applications for iOS and Android using technologies like React Native and Flutter. What type of mobile app are you looking to build?",
                    design: "Our design services include UI/UX design, branding, and graphic design. We focus on creating beautiful, user-centered designs. What kind of design project do you have in mind?",
                    marketing: "Our digital marketing services include SEO, social media marketing, and PPC advertising. How can we help with your marketing needs?"
                },
                pricing: "Our pricing depends on the scope and requirements of your project. Could you share more details about what you're looking for?",
                contact: "You can reach us at contact@yourcompany.com or call us at +1 (555) 123-4567. Our team is available Monday to Friday, 9 AM to 6 PM.",
                help: "I'm here to help! Could you please let me know what you need assistance with? You can ask about our services, pricing, or request to speak with our team.",
                appointment: "I'd be happy to schedule a call or meeting. Please let me know your availability and preferred time, and I'll arrange it with our team.",
                portfolio: "You can view our portfolio at [portfolio link]. We've worked on various projects including [examples]. Is there a specific type of project you'd like to see?",
                default: "I'm not sure I understand. Could you please rephrase your question or let me know how I can assist you?"
            };
        }

        generateResponse(intent, entities = {}) {
            let response = '';
            
            switch(intent) {
                case 'services':
                    if (entities.serviceTypes && entities.serviceTypes.length > 0) {
                        const serviceType = entities.serviceTypes[0];
                        response = this.responses.services[serviceType] || this.responses.services.default;
                    } else {
                        response = this.responses.services.default;
                    }
                    break;
                case 'pricing':
                    response = this.responses.pricing;
                    if (entities.budgets && entities.budgets.length > 0) {
                        response += ` I see you mentioned a budget around ${entities.budgets[0]}. `;
                        response += 'Would you like me to provide a more detailed quote based on your requirements?';
                    }
                    break;
                case 'appointment':
                    response = this.responses.appointment;
                    if (entities.timeframes && entities.timeframes.length > 0) {
                        response += ` I see you mentioned ${entities.timeframes[0]}. `;
                        response += 'Let me check our availability around that time.';
                    }
                    break;
                default:
                    if (this.responses[intent]) {
                        const responses = Array.isArray(this.responses[intent]) ? 
                            this.responses[intent] : [this.responses[intent]];
                        response = responses[Math.floor(Math.random() * responses.length)];
                    } else {
                        response = this.responses.default;
                    }
            }

            return response;
        }
    }

    // Initialize Response Generator
    const responseGenerator = new ResponseGenerator();

    // Function to process user message with enhanced NLU
    async function processUserMessage(message) {
        // Special case: Address query
        if (isAskingForAddress(message)) {
            addMessage('Sy No 83/1, T Hub Foundation, Plot No 1/C, Knowledge City Rd, Silpa Gram Craft Village, Madhapur, Rai Durg, Hyderabad, Telangana 500081', 'bot', new Date());
            return;
        }
        
        // Special case: Company info query
        if (isAskingAboutCompany(message)) {
            addMessage('Angadi World Technologies', 'bot', new Date());
            addMessage('Angadi World Technologies (AWT) specializes in a comprehensive suite of IT services, including website development, mobile app development, QR code technology solutions, digital marketing strategies, and project consulting to elevate your business.', 'bot', new Date());
            return;
        }
        
        // Special case: Tech stack query
        if (isAskingAboutTechStack(message)) {
            showTechStackInfo();
            return;
        }
        
        // Analyze the message with NLU
        const intent = nlu.detectIntent(message);
        const entities = nlu.extractEntities(message);
        const sentiment = nlu.analyzeSentiment(message);
        
        // Update conversation context
        conversationContext.setIntent(intent.intent, intent.confidence);
        conversationContext.entities = entities;
        conversationContext.sentiment = sentiment.sentiment;
        conversationContext.addMessage('user', message);
        
        // Generate response based on detected intent and entities
        const response = responseGenerator.generateResponse(intent.intent, entities);
        addMessage(response, 'bot', new Date());
        
        // Handle specific intents with additional context
        switch(intent.intent) {
            case 'services':
                // Show service options if no specific service was mentioned
                if (!entities.serviceTypes || entities.serviceTypes.length === 0) {
                    showServicesInfo();
                }
                break;
                
            case 'appointment':
                // Show booking options if timeframe was mentioned
                if (entities.timeframes && entities.timeframes.length > 0) {
                    const timeOption = entities.timeframes[0];
                    addMessage(`Would you like me to check our availability for ${timeOption}?`, 'bot', new Date());
                } else {
                    addMessage('When would you like to schedule the appointment?', 'bot', new Date());
                }
                break;
                
            case 'pricing':
                // If budget was mentioned, provide more tailored response
                if (entities.budgets && entities.budgets.length > 0) {
                    addMessage('Would you like me to connect you with our sales team for a detailed quote?', 'bot', new Date());
                }
                break;
        }
        
        // Check for QR code technology query
        if (isAskingAboutQRCode(message)) {
            showQRCodeInfo();
            return;
        }
        
        // Check for services/solutions query
        if (isAskingAboutServices(message)) {
            showServicesInfo();
            return;
        }
        
        // Check for contact details query
        if (isAskingForContactDetails(message)) {
            showContactDetails();
            return;
        }

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