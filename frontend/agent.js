import socket from './socket.js';

document.addEventListener('DOMContentLoaded', () => {
    const pendingRequests = document.getElementById('pendingRequests');
    const agentChatMessages = document.getElementById('agentChatMessages');
    const agentInput = document.getElementById('agentInput');
    const agentSendBtn = document.getElementById('agentSendBtn');
    const currentChatUser = document.getElementById('currentChatUser');
    const agentName = document.getElementById('agentName');
    const agentExitBtn = document.getElementById('agentExitBtn');
    const loginWrapper = document.getElementById('agentLoginWrapper');
    const dashboardSection = document.getElementById('agent-dashboard-section');
    const form = document.getElementById('agentLoginForm');
    const errorDiv = document.getElementById('loginError');
    const passwordInput = document.getElementById('password');
    const showPasswordCheckbox = document.getElementById('showPassword');

    // Connection status logging
    socket.on('connect', () => {
        console.log('✅ Agent WebSocket Connected! Socket ID:', socket.id);
        agentSocketId = socket.id;  // Store the socket ID
        agentName.textContent = `Agent Online (ID: ${socket.id})`;
    });

    socket.on('disconnect', () => {
        console.log('❌ Agent WebSocket Disconnected!');
        agentName.textContent = 'Agent Offline - Reconnecting...';
    });

    socket.on('connect_error', (error) => {
        console.error('Agent WebSocket Connection Error:', error.message);
        agentName.textContent = `Connection Error: ${error.message}`;
    });

    let currentChatId = null;
    let currentUserId = null;

    // Connect as agent
    socket.emit('agent_connect', {
        name: 'John Doe',
        timestamp: new Date()
    });

    // Store agent's socket ID
    let agentSocketId = null;

    // Function to add a request to the pending list
    function addRequest(request) {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'request-card';
        // Format the date
        let timeString = 'Unknown time';
        if (request.timestamp) {
            try {
                const date = new Date(request.timestamp);
                timeString = date.toLocaleString();
            } catch (e) {}
        }
        requestDiv.innerHTML = `
            <div><strong>${request.name || 'Unknown'}</strong></div>
            <div style="margin: 4px 0; color: #333;">${request.query || 'No query provided'}</div>
            <div style="font-size: 0.9em; color: #888;">${timeString}</div>
            <button class="join-chat-btn">Join Chat</button>
        `;
        // Join Chat button handler
        requestDiv.querySelector('.join-chat-btn').addEventListener('click', () => {
            console.log('Join Chat clicked for request:', request.id);
            console.log('Full request object:', request);
            if (!request.id) {
                console.error('No request.id found!');
                return;
            }
            console.log('About to make PUT request for:', request.id);
            fetch('http://localhost:5000/api/requests/' + request.id + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' })
            })
            .then(res => res.json())
            .then(response => {
                console.log('Join chat API response:', response);
                socket.emit('join_chat', { requestId: request.id });
                currentChatId = request.id;
                currentChatUser.textContent = `User: ${request.name || 'Unknown'}`;
            })
            .catch(error => {
                console.error('Error joining chat via API:', error);
            });
            requestDiv.remove();
        });
        pendingRequests.appendChild(requestDiv);
    }

    // Function to add message to chat
    function addMessage(message, isAgent = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-container';  // Add container for consistent layout
        
        const messageContent = document.createElement('div');
        // Add class for alignment
        if (isAgent) {
            messageContent.className = 'message agent';
            messageContent.style.alignSelf = 'flex-start';
            messageContent.style.background = '#e3f2fd';
            messageContent.style.color = '#1976d2';
        } else {
            messageContent.className = 'message user';
            messageContent.style.alignSelf = 'flex-end';
            messageContent.style.background = '#ede7f6';
            messageContent.style.color = '#5a4fff';
        }
        
        // Consistent styling for all messages
        messageContent.style.padding = '8px 14px';
        messageContent.style.borderRadius = '16px';
        messageContent.style.marginBottom = '8px';
        messageContent.style.maxWidth = '70%';
        messageContent.style.wordWrap = 'break-word';
        messageContent.style.display = 'inline-block';
        messageContent.textContent = message;

        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.style.fontSize = '0.75em';
        timestamp.style.color = '#888';
        timestamp.style.marginTop = '4px';
        timestamp.textContent = new Date().toLocaleTimeString();

        messageContent.appendChild(timestamp);
        messageDiv.appendChild(messageContent);
        agentChatMessages.appendChild(messageDiv);
        agentChatMessages.scrollTop = agentChatMessages.scrollHeight;
    }

    // Remove or comment out WebSocket handlers that add requests dynamically
    // socket.on('pending_requests', (requests) => {
    //     requests.forEach(request => addRequest(request));
    // });

    // socket.on('new_request', (request) => {
    //     addRequest(request);
    // });

    socket.on('receive_message', (data) => {
        addMessage(data.message, false);
    });

    socket.on('request_accepted', (data) => {
        currentChatId = data.chatId;
        addMessage(`Chat session started with user ${currentUserId}`);
    });

    socket.on('chat_history', (data) => {
        console.log('Received chat history:', data);  // Debug log
        agentChatMessages.innerHTML = '';
        const messages = Array.isArray(data) ? data : data.messages;
        if (messages) {
        messages.forEach(msg => {
            addMessage(msg.message, msg.senderId === socket.id);
        });
        }
        // Set currentUserId from the userSocketId in the data
        if (data.userSocketId) {
            currentUserId = data.userSocketId;
            console.log('Set currentUserId to:', currentUserId);  // Debug log
        } else {
            console.warn('No userSocketId received in chat history. This may prevent sending messages.');
            // Try to get the user ID from the first user message
            const userMessage = messages?.find(msg => msg.sender === 'user');
            if (userMessage) {
                console.log('Found user message:', userMessage);
                // You might want to handle this case differently
                // For now, we'll just log it
            }
        }
    });

    socket.on('message', (data) => {
        addMessage(data.message, data.senderId === socket.id);
    });

    // Handle sending messages
    function sendMessage() {
        const message = agentInput.value.trim();
        console.log('SendMessage called:', { 
            message, 
            currentChatId, 
            currentUserId,
            agentSocketId 
        });
        if (message && currentChatId && currentUserId && agentSocketId) {
            socket.emit('send_message', {
                message,
                recipientId: currentUserId,
                senderId: agentSocketId,  // Use stored socket ID
                chatId: currentChatId
            });
            addMessage(message, true);
            agentInput.value = '';
        } else {
            console.warn('Cannot send message. Missing:', {
                message, 
                currentChatId, 
                currentUserId,
                agentSocketId
            });
        }
    }

    // Send message on button click
    agentSendBtn.addEventListener('click', sendMessage);

    // Send message on Enter key
    agentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Typing indicator logic for agent
    agentInput.addEventListener('input', () => {
        if (currentChatId) {
            socket.emit('typing', { chatId: currentChatId, user: 'agent' });
        }
    });

    socket.on('typing', (data) => {
        showTypingIndicator(data.user === 'user' ? 'User is typing...' : 'Agent is typing...');
    });

    function showTypingIndicator(message) {
        let indicator = document.getElementById('typingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typingIndicator';
            indicator.className = 'message bot typing-indicator';
            agentChatMessages.appendChild(indicator);
        }
        indicator.textContent = message;
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            if (indicator) indicator.remove();
        }, 2000);
    }

    // Fetch requests from backend and display them
    function fetchRequests() {
        fetch('http://localhost:5000/api/requests')
            .then(res => res.json())
            .then(requests => {
                pendingRequests.innerHTML = '';
                requests.forEach(addRequest);
            })
            .catch(error => {
                console.error('Error fetching requests:', error);
                pendingRequests.innerHTML = '<div style="color:red;">Failed to fetch requests</div>';
            });
    }

    // Fetch requests on page load
    fetchRequests();

    // Add CSS styles to the document
    const style = document.createElement('style');
    style.textContent = `
        .message-container {
            display: flex;
            margin: 8px 0;
            width: 100%;
        }
        .message-container .agent {
            margin-right: auto;
        }
        .message-container .user {
            margin-left: auto;
        }
        .message {
            position: relative;
            padding: 8px 14px;
            border-radius: 16px;
            max-width: 70%;
            word-wrap: break-word;
        }
        .message-timestamp {
            font-size: 0.75em;
            color: #888;
            margin-top: 4px;
            text-align: right;
        }
    `;
    document.head.appendChild(style);

    if (agentExitBtn) {
        agentExitBtn.addEventListener('click', async () => {
            // Disable button to prevent double click
            agentExitBtn.disabled = true;

            // Show confirmation dialog
            const resolved = confirm('Is the issue resolved? Click OK for Yes, Cancel for No.');
            let reason = '';
            if (!resolved) {
                reason = prompt('Please provide the reason for leaving the chat:');
                if (!reason) {
                    alert('You must provide a reason to leave the chat.');
                    agentExitBtn.disabled = false;
                    return;
                }
            }

            agentChatMessages.innerHTML = '';
            currentChatUser.textContent = '';
            // Emit event to backend with chat and user info, and resolution status
            socket.emit('agent_exit_chat', {
                chatId: currentChatId,
                userSocketId: currentUserId,
                resolved: resolved,
                reason: reason
            });
            currentChatId = null;
            currentUserId = null;
            agentExitBtn.disabled = false;
        });
    }

    // Show/hide password
    if (showPasswordCheckbox && passwordInput) {
        showPasswordCheckbox.addEventListener('change', () => {
            passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
        });
    }

    // Check for token on load
    const token = localStorage.getItem('agentToken');
    if (token) {
        loginWrapper.style.display = 'none';
        dashboardSection.style.display = '';
        // ... load dashboard data here ...
    } else {
        loginWrapper.style.display = '';
        dashboardSection.style.display = 'none';
    }

    // Login form handler
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.textContent = '';
            const username = document.getElementById('username').value.trim();
            const password = passwordInput.value;
            try {
                const res = await fetch('http://localhost:5000/api/agent/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    localStorage.setItem('agentToken', data.token);
                    loginWrapper.style.display = 'none';
                    dashboardSection.style.display = '';
                    // ... load dashboard data here ...
                } else {
                    errorDiv.textContent = data.error || 'Login failed.';
                }
            } catch (err) {
                errorDiv.textContent = 'Server error. Please try again.';
            }
        });
    }
}); 