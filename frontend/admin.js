// Admin Dashboard JS
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    const form = document.getElementById('adminLoginForm');
    const errorDiv = document.getElementById('loginError');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const adminNameElement = document.getElementById('adminName');
    const adminStatusText = document.getElementById('adminStatusText');
    // Show/hide dashboard based on login
    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = '';
        updateAdminStatus('online');
        // Update admin name in header when showing dashboard
        const token = localStorage.getItem('adminToken');
        if (token) {
            setAdminHeader(getAdminNameFromToken(token));
        }
    }
    function showLogin() {
        loginSection.style.display = '';
        dashboardSection.style.display = 'none';
        updateAdminStatus('offline');
    }
    // Update admin status
    function updateAdminStatus(status) {
        if (adminStatusText) {
            adminStatusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            const statusDot = document.querySelector('.admin-status-dot');
            if (statusDot) {
                statusDot.style.background = status === 'online' ? '#1de9b6' : '#f44336';
            }
        }
    }
    // Helper to set admin name in header
    function setAdminHeader(name) {
        // Update the admin name in the header
        const adminNameElement = document.getElementById('adminName');
        if (adminNameElement) {
            adminNameElement.textContent = name;
        }
        
        // Also update in any other elements that might show the admin name
        const adminNameElements = document.querySelectorAll('.admin-header-admin-name, .admin-name');
        adminNameElements.forEach(element => {
            if (element.id !== 'adminName') {
                element.textContent = name;
            }
        });
    }

    // Check for token on load
    const token = localStorage.getItem('adminToken');
    if (token) {
        showDashboard();
        fetchAllRequests();
        fetchResolvedRequests();
        setAdminHeader(getAdminNameFromToken(token));
    } else {
        showLogin();
    }

    // Show/hide password with checkbox
    const showPasswordCheckbox = document.getElementById('showPassword');
    const passwordInput = document.getElementById('password');
    if (showPasswordCheckbox && passwordInput) {
        showPasswordCheckbox.addEventListener('change', () => {
            passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
        });
    }

    // Parse JWT to get admin name (if available)
    function getAdminNameFromToken(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.username || 'Admin';
        } catch {
            return 'Admin';
        }
    }

    // Login form handler with animated button
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.textContent = '';
            const loginBtn = document.getElementById('loginBtn');
            loginBtn.disabled = true;
            const username = document.getElementById('username').value.trim();
            const password = passwordInput.value;
            try {
                const res = await fetch('http://localhost:5000/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    localStorage.setItem('adminToken', data.token);
                    // Use the username from the response if available, otherwise use the input username
                    const displayName = data.admin?.username || username;
                    setAdminHeader(displayName);
                    showDashboard();
                    fetchAllRequests();
                    fetchResolvedRequests();
                } else {
                    const errorMessage = data.error || 'Login failed';
                    console.error('Login error:', errorMessage);
                    errorDiv.innerHTML = `❌ ${errorMessage}`;
                }
            } catch (err) {
                console.error('Login error:', err);
                errorDiv.innerHTML = '❌ Server error. Please check console and try again.';
            }
            loginBtn.disabled = false;
        });
    }

    // Tab switching
    const tabAll = document.getElementById('tab-all');
    const tabResolved = document.getElementById('tab-resolved');
    const tabTickets = document.getElementById('tab-tickets');
    const tabAgents = document.getElementById('tab-agents');
    const allPanel = document.getElementById('all-requests-panel');
    const resolvedPanel = document.getElementById('resolved-requests-panel');
    const ticketsPanel = document.getElementById('tickets-content');
    const agentsPanel = document.getElementById('agents-panel');

    if (tabAll && tabResolved && tabTickets && tabAgents) {
        tabAll.addEventListener('click', () => {
            tabAll.classList.add('active');
            tabResolved.classList.remove('active');
            tabTickets.classList.remove('active');
            tabAgents.classList.remove('active');
            allPanel.style.display = '';
            resolvedPanel.style.display = 'none';
            ticketsPanel.style.display = 'none';
            agentsPanel.style.display = 'none';
        });
        
        tabResolved.addEventListener('click', () => {
            tabResolved.classList.add('active');
            tabAll.classList.remove('active');
            tabTickets.classList.remove('active');
            tabAgents.classList.remove('active');
            allPanel.style.display = 'none';
            resolvedPanel.style.display = '';
            ticketsPanel.style.display = 'none';
            agentsPanel.style.display = 'none';
        });
        
        tabTickets.addEventListener('click', () => {
            tabTickets.classList.add('active');
            tabAll.classList.remove('active');
            tabResolved.classList.remove('active');
            tabAgents.classList.remove('active');
            allPanel.style.display = 'none';
            resolvedPanel.style.display = 'none';
            ticketsPanel.style.display = 'block';
            agentsPanel.style.display = 'none';
            // Initialize or refresh tickets when the tab is clicked
            if (window.ticketManager) {
                window.ticketManager.fetchTickets();
            }
        });
        
        tabAgents.addEventListener('click', () => {
            tabAgents.classList.add('active');
            tabAll.classList.remove('active');
            tabResolved.classList.remove('active');
            tabTickets.classList.remove('active');
            allPanel.style.display = 'none';
            resolvedPanel.style.display = 'none';
            ticketsPanel.style.display = 'none';
            agentsPanel.style.display = '';
            fetchAgents();
        });
    }

    // Fetch and render all requests
    async function fetchAllRequests() {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('http://localhost:5000/api/requests', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const requests = await res.json();
        renderRequestsTable(requests, document.querySelector('#all-requests-table tbody'));
    }

    // Fetch and render resolved requests
    async function fetchResolvedRequests() {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('http://localhost:5000/api/resolved-requests', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const requests = await res.json();
        renderResolvedTable(requests, document.querySelector('#resolved-requests-table tbody'));
    }

    // Fetch and render agents
    async function fetchAgents() {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('http://localhost:5000/api/agents', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const agents = await res.json();
        renderAgentsTable(agents, document.querySelector('#agents-table tbody'));
    }

    // Render all requests table
    function renderRequestsTable(requests, tbody) {
        tbody.innerHTML = '';
        requests.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.name || ''}</td>
                <td>${r.query || ''}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</td>
                <td>
                    <!-- Future: Add action buttons here -->
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render resolved requests table
    function renderResolvedTable(requests, tbody) {
        tbody.innerHTML = '';
        requests.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.name || ''}</td>
                <td>${r.query || ''}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</td>
                <td>${r.resolutionNote || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render agents table
    function renderAgentsTable(agents, tbody) {
        tbody.innerHTML = '';
        agents.forEach(agent => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${agent.name || ''}</td>
                <td>${agent.username || ''}</td>
                <td>${agent.status || 'Unknown'}</td>
                <td>
                    <button class="action-btn action-delete" data-id="${agent._id}">Delete</button>
                    <button class="action-btn action-resolve" data-id="${agent._id}" data-action="change-password">Change Password</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for action buttons
        tbody.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            const agentId = button.getAttribute('data-id');
            if (!agentId) return;
            
            if (button.classList.contains('action-delete')) {
                handleDeleteAgent(agentId);
            } else if (button.classList.contains('action-resolve') && button.getAttribute('data-action') === 'change-password') {
                handleChangePassword(agentId);
            }
        });
        
        // Handle delete agent
        async function handleDeleteAgent(agentId) {
            if (confirm('Are you sure you want to delete this agent?')) {
                try {
                    const token = localStorage.getItem('adminToken');
                    const res = await fetch(`http://localhost:5000/api/agent/${agentId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (res.ok) {
                        // Refresh the agents list
                        fetchAgents();
                        alert('Agent deleted successfully');
                    } else {
                        const data = await res.json();
                        alert(data.error || 'Failed to delete agent');
                    }
                } catch (error) {
                    alert('Error deleting agent: ' + error.message);
                }
            }
        }
        
        // Handle change password
        async function handleChangePassword(agentId) {
            const newPassword = prompt('Enter new password for this agent:');
            if (!newPassword) return; // User cancelled
            
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters long');
                return;
            }
            
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch(`http://localhost:5000/api/agent/${agentId}/password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ password: newPassword })
                });
                
                if (res.ok) {
                    alert('Password updated successfully');
                } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to update password');
                }
            } catch (error) {
                alert('Error updating password: ' + error.message);
            }
        }
    }

    // Optionally, refresh data every minute
    setInterval(() => {
        if (localStorage.getItem('adminToken')) {
            fetchAllRequests();
            fetchResolvedRequests();
            fetchAgents();
        }
    }, 60000);

    // Add Create Agent form handler
    const createAgentForm = document.getElementById('createAgentForm');
    const createAgentError = document.getElementById('createAgentError');
    
    if (createAgentForm) {
        createAgentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('agentName').value.trim();
            const username = document.getElementById('agentUsername').value.trim();
            const password = document.getElementById('agentPassword').value;
            
            if (!name || !username || !password) {
                createAgentError.textContent = 'Please fill in all fields';
                return;
            }
            
            try {
                const token = localStorage.getItem('adminToken');
                const response = await fetch('http://localhost:5000/api/agent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Clear form and show success message
                    createAgentForm.reset();
                    createAgentError.textContent = '';
                    alert('Agent created successfully!');
                    // Refresh agents list
                    fetchAgents();
                } else {
                    createAgentError.textContent = data.error || 'Failed to create agent';
                }
            } catch (error) {
                console.error('Error creating agent:', error);
                createAgentError.textContent = 'Error connecting to server';
            }
        });
    }

    // Add logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminToken');
            showLogin();
        });
    }
});