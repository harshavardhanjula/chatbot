import socket from './socket.js';

document.addEventListener('DOMContentLoaded', () => {
    // Get all required DOM elements
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('agentLoginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const showPasswordCheckbox = document.getElementById('showPassword');
    const passwordInput = document.getElementById('password');
    const agentName = document.getElementById('agentName');
    const pendingRequests = document.getElementById('pendingRequests');
    const agentChatMessages = document.getElementById('agentChatMessages');
    const agentInput = document.getElementById('agentInput');
    const agentSendBtn = document.getElementById('agentSendBtn');
    const currentChatUser = document.getElementById('currentChatUser');
    const agentExitBtn = document.getElementById('agentExitBtn');
    const loginWrapper = document.getElementById('agentLoginWrapper');

    // Store agent's socket ID and chat state
    let agentSocketId = null;
    let currentChatId = null;
    let currentUserId = null;

    // Connection status logging
    socket.on('connect', () => {
        console.log('✅ Agent WebSocket Connected! Socket ID:', socket.id);
        agentSocketId = socket.id;
        if (agentName) {
        agentName.textContent = `Agent Online (ID: ${socket.id})`;
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Agent WebSocket Disconnected!');
        if (agentName) {
        agentName.textContent = 'Agent Offline - Reconnecting...';
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Agent WebSocket Connection Error:', error.message);
        if (agentName) {
        agentName.textContent = `Connection Error: ${error.message}`;
        }
    });

    // Check if agent is already logged in
    const agentToken = localStorage.getItem('agentToken');
    if (agentToken) {
        showDashboard();
    } else {
        showLogin();
    }

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
                
                // Show chat area and hide no active chat message
                document.getElementById('liveChatArea').style.display = 'flex';
                document.getElementById('noActiveChat').style.display = 'none';
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
        
        // Scroll to bottom after adding message
        scrollToBottom();
    }

    // Function to scroll chat to bottom
    function scrollToBottom() {
        if (agentChatMessages) {
            agentChatMessages.scrollTop = agentChatMessages.scrollHeight;
        }
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
        #agentChatMessages {
            height: calc(100vh - 200px);
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
        }
        #dashboard-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            background-color: #f5f5f5;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        #pendingRequests {
            width: 100%;
            max-width: 600px;
            margin-top: 20px;
        }
        .request-card {
            background-color: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .join-chat-btn {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .join-chat-btn:hover {
            background-color: #45a049;
        }
        #endChatBtn {
            background-color: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        #endChatBtn:hover {
            background-color: #d32f2f;
        }
    `;
    document.head.appendChild(style);

    // Add End Chat button to liveChatArea
    const endChatBtn = document.createElement('button');
    endChatBtn.id = 'endChatBtn';
    endChatBtn.textContent = 'End Chat';
    endChatBtn.style.marginTop = '10px';
    document.getElementById('liveChatArea').appendChild(endChatBtn);

    // Add event listener for End Chat button
    endChatBtn.addEventListener('click', async () => {
        if (!currentChatId) {
            alert('No active chat to end.');
            return;
        }
        endChatBtn.disabled = true;
        try {
            // Get agent name from localStorage or fallback
            const agentName = localStorage.getItem('agentName') || localStorage.getItem('agentId') || 'Unknown Agent';
            // Update request status to resolved and include agent name
            const response = await fetch(`http://localhost:5000/api/requests/${currentChatId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'resolved', agentName })
            });
            const data = await response.json();
            if (response.ok) {
                console.log('Request marked as resolved:', data);
                agentChatMessages.innerHTML = '';
                currentChatUser.textContent = '';
                // Optionally emit a socket event
                socket.emit('agent_exit_chat', {
                    chatId: currentChatId,
                    userSocketId: currentUserId,
                    resolved: true
                });
                currentChatId = null;
                currentUserId = null;
                document.getElementById('liveChatArea').style.display = 'none';
                document.getElementById('noActiveChat').style.display = 'block';
                // Refresh both pending and resolved requests
                fetchRequests();
                fetchResolvedRequests();
            } else {
                alert(data.message || 'Failed to resolve chat.');
            }
        } catch (error) {
            console.error('Error marking request as resolved:', error);
            alert('Error ending chat.');
        }
        endChatBtn.disabled = false;
    });

    // Show/hide password
    if (showPasswordCheckbox && passwordInput) {
        showPasswordCheckbox.addEventListener('change', () => {
            passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
        });
    }

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = passwordInput.value;

            try {
                const response = await fetch('http://localhost:5000/api/agent/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('agentToken', data.token);
                    localStorage.setItem('agentId', data.agentId);
                    showDashboard();
                } else {
                    if (loginError) {
                        loginError.textContent = data.message || 'Login failed. Please check your credentials.';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                if (loginError) {
                    loginError.textContent = 'An error occurred. Please try again later.';
                }
            }
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('agentToken');
            localStorage.removeItem('agentId');
            showLogin();
        });
    }

    function showLogin() {
        if (loginSection) {
            loginSection.style.display = 'block';
        }
        if (dashboardSection) {
            dashboardSection.style.display = 'none';
        }
    }

    function showDashboard() {
        if (loginSection) {
            loginSection.style.display = 'none';
                }
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
        }
        initializeDashboard();
    }

    function initializeDashboard() {
        const agentId = localStorage.getItem('agentId');
        if (!agentId) {
            showLogin();
            return;
        }

        // Connect to socket with agent ID
        socket.emit('agent_connect', {
            agentId: agentId,
            timestamp: new Date()
        });

        // Listen for new chat requests
        socket.on('new_chat_request', (data) => {
            if (pendingRequests) {
                addChatToList(data);
            }
        });

        // Listen for chat updates
        socket.on('chat_update', (data) => {
            updateChatInList(data);
        });
    }

    function addChatToList(chat) {
        if (!pendingRequests) return;

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.chatId;
        chatItem.innerHTML = `
            <div class="chat-user">${chat.userName || 'Unknown User'}</div>
            <div class="chat-preview">${chat.lastMessage || 'New chat'}</div>
        `;
        chatItem.addEventListener('click', () => selectChat(chat.chatId));
        pendingRequests.appendChild(chatItem);
    }

    function updateChatInList(chat) {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chat.chatId}"]`);
        if (chatItem) {
            const preview = chatItem.querySelector('.chat-preview');
            if (preview) {
                preview.textContent = chat.lastMessage || 'New message';
            }
        }
    }

    function selectChat(chatId) {
        // Remove active class from all chats
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected chat
        const selectedChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('active');
        }

        // Update current chat ID
        currentChatId = chatId;

        // Load chat messages
        loadChatMessages(chatId);
    }

    function loadChatMessages(chatId) {
        if (!agentChatMessages) return;

        // Clear existing messages
        agentChatMessages.innerHTML = '';

        // Fetch chat history
        fetch(`http://localhost:5000/api/chats/${chatId}/messages`)
            .then(response => response.json())
            .then(data => {
                if (data.messages) {
                    data.messages.forEach(msg => {
                        addMessage(msg.content, msg.sender === 'agent');
                    });
                    // Scroll to bottom after loading messages
                    scrollToBottom();
                }
            })
            .catch(error => {
                console.error('Error loading chat messages:', error);
                if (agentChatMessages) {
                    agentChatMessages.innerHTML = '<div class="error">Failed to load messages</div>';
                }
            });
    }
});