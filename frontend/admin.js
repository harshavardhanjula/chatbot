// Admin Dashboard JS
let logoutBtn = null;

document.addEventListener('DOMContentLoaded', () => {
    logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            deleteCookie('adminToken');
            showLogin();
        });
    }
    // Elements
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    const form = document.getElementById('adminLoginForm');
    const errorDiv = document.getElementById('loginError');
    const adminNameElement = document.getElementById('adminName');
    const adminStatusText = document.getElementById('adminStatusText');

    // Show/hide dashboard based on login
    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = '';
        updateAdminStatus('online');
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
        if (adminNameElement) {
            adminNameElement.textContent = name;
        }
    }

    // Check for token in cookies on load
    const token = getCookie('adminToken');
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
                    setCookie('adminToken', data.token, 1); // 1 day expiration
                    setAdminHeader(data.admin && data.admin.username ? data.admin.username : username);
                    document.getElementById('loginCenterWrapper').style.display = 'none';
                    showDashboard();
                    fetchAllRequests();
                    fetchResolvedRequests();
                } else {
                    errorDiv.innerHTML = '❌ ' + (data.error || 'Login failed.');
                }
            } catch (err) {
                errorDiv.innerHTML = '❌ Server error. Please try again.';
            }
            loginBtn.disabled = false;
        });
    }

    // Tab switching
    const tabAll = document.getElementById('tab-all');
    const tabResolved = document.getElementById('tab-resolved');
    const tabAgents = document.getElementById('tab-agents');
    const allPanel = document.getElementById('all-requests-panel');
    const resolvedPanel = document.getElementById('resolved-requests-panel');
    const agentsPanel = document.getElementById('agents-panel');

    if (tabAll && tabResolved && tabAgents) {
        tabAll.addEventListener('click', () => {
            tabAll.classList.add('active');
            tabResolved.classList.remove('active');
            tabAgents.classList.remove('active');
            allPanel.style.display = '';
            resolvedPanel.style.display = 'none';
            agentsPanel.style.display = 'none';
        });
        tabResolved.addEventListener('click', () => {
            tabResolved.classList.add('active');
            tabAll.classList.remove('active');
            tabAgents.classList.remove('active');
            allPanel.style.display = 'none';
            resolvedPanel.style.display = '';
            agentsPanel.style.display = 'none';
        });
        tabAgents.addEventListener('click', () => {
            tabAgents.classList.add('active');
            tabAll.classList.remove('active');
            tabResolved.classList.remove('active');
            allPanel.style.display = 'none';
            resolvedPanel.style.display = 'none';
            agentsPanel.style.display = '';
            fetchAgents();
        });
    }

    // Fetch and render all requests
    async function fetchAllRequests() {
        const token = getCookie('adminToken');
        const res = await fetch('http://localhost:5000/api/requests', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const requests = await res.json();
        renderRequestsTable(requests, document.querySelector('#all-requests-table tbody'));
    }

    // Fetch and render resolved requests
    async function fetchResolvedRequests() {
        const token = getCookie('adminToken');
        const res = await fetch('http://localhost:5000/api/resolved-requests', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const requests = await res.json();
        renderResolvedTable(requests, document.querySelector('#resolved-requests-table tbody'));
    }

    // Fetch and render agents
    async function fetchAgents() {
        const token = getCookie('adminToken');
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

        // Add event listeners for delete buttons
        const deleteButtons = tbody.querySelectorAll('.action-delete');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this agent?')) {
                    const agentId = button.getAttribute('data-id');
                    try {
                        const token = getCookie('adminToken');
                        const res = await fetch(`http://localhost:5000/api/agent/${agentId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (res.ok) {
                            // Refresh the agents list
                            fetchAgents();
                        } else {
                            const data = await res.json();
                            alert(data.error || 'Failed to delete agent');
                        }
                    } catch (error) {
                        alert('Error deleting agent: ' + error.message);
                    }
                }
            });
        });
    }

    // Optionally, refresh data every minute
    setInterval(() => {
        if (getCookie('adminToken')) {
            fetchAllRequests();
            fetchResolvedRequests();
            fetchAgents();
        }
    }, 60000);

    // Other event handlers and initialization code...
}); // Close DOMContentLoaded event listener

// Cookie utility functions
function setCookie(name, value, days) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Strict';
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/; SameSite=Strict';
}