// Admin Dashboard JS

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    const form = document.getElementById('adminLoginForm');
    const errorDiv = document.getElementById('loginError');

    // Show/hide dashboard based on login
    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = '';
    }
    function showLogin() {
        loginSection.style.display = '';
        dashboardSection.style.display = 'none';
    }

    // Check for token on load
    const token = localStorage.getItem('adminToken');
    if (token) {
        showDashboard();
        fetchAllRequests();
        fetchResolvedRequests();
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

    // Helper to set admin name in header
    function setAdminHeader(name) {
        const headerRight = document.getElementById('adminHeaderRight');
        if (headerRight) {
            headerRight.innerHTML = `
                <span class="admin-header-admin-name">${name}</span>
                <button class="admin-logout-btn" id="adminLogoutBtn">Logout</button>
            `;
            const logoutBtn = document.getElementById('adminLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem('adminToken');
                    setAdminHeader('');
                    showLogin();
                });
            }
        }
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

    // On load, set header if logged in
    if (token) {
        setAdminHeader(getAdminNameFromToken(token));
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
                <td>${r.email || ''}</td>
                <td>${r.query || ''}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>${r.agentId || ''}</td>
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
                <td>${r.email || ''}</td>
                <td>${r.query || ''}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>${r.agentId || ''}</td>
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
    }

    // Optionally, refresh data every minute
    setInterval(() => {
        if (localStorage.getItem('adminToken')) {
            fetchAllRequests();
            fetchResolvedRequests();
        }
    }, 60000);
}); 