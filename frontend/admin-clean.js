// Admin Dashboard JS

// Global variables
const API_BASE_URL = 'http://localhost:5000/api';

// DOM Elements
const elements = {
    loginSection: null,
    dashboardSection: null,
    loginForm: null,
    errorDiv: null,
    adminNameElement: null,
    adminStatusText: null,
    logoutBtn: null,
    loadingOverlay: null
};

// State
const state = {
    isInitialLoad: true,
    currentTab: 'requests'
};

// Utility Functions
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

async function fetchWithAuth(url, options = {}) {
    const token = getCookie('adminToken');
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            deleteCookie('adminToken');
            showLogin();
            throw new Error('Session expired. Please login again.');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Something went wrong');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showError(error.message);
        throw error;
    }
}

// UI Functions
function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'flex';
        return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-overlay';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        flex-direction: column;
    `;
    loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <p style="margin-top: 20px; font-size: 16px; color: #333;">Loading...</p>
    `;
    document.body.appendChild(loadingDiv);
    elements.loadingOverlay = loadingDiv;
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.transition = 'opacity 0.3s';
        elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.style.display = 'none';
                elements.loadingOverlay.style.opacity = '1';
            }
        }, 300);
    }
}

function showError(message) {
    if (elements.errorDiv) {
        elements.errorDiv.textContent = message;
        elements.errorDiv.style.display = 'block';
        setTimeout(() => {
            if (elements.errorDiv) {
                elements.errorDiv.style.display = 'none';
            }
        }, 5000);
    }
}

function showLogin() {
    if (elements.loginSection) elements.loginSection.style.display = 'block';
    if (elements.dashboardSection) elements.dashboardSection.style.display = 'none';
    
    // Clear any sensitive data
    if (elements.loginForm) elements.loginForm.reset();
    if (elements.errorDiv) elements.errorDiv.style.display = 'none';
}

function showDashboard() {
    if (elements.loginSection) elements.loginSection.style.display = 'none';
    if (elements.dashboardSection) elements.dashboardSection.style.display = 'block';
    
    // Update admin info in the UI
    const adminName = getCookie('adminName');
    if (elements.adminNameElement) {
        elements.adminNameElement.textContent = adminName || 'Admin';
    }
    
    // Load initial data if it's the first load
    if (state.isInitialLoad) {
        state.isInitialLoad = false;
        loadDashboardData();
    }
}

// Utility Functions
async function fetchWithLogging(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.response = response;
            throw error;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        if (error.response) {
            let errorMessage = error.message;
            try {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // If we can't parse the error response, use the status text
                errorMessage = error.response.statusText || errorMessage;
            }
            error.message = errorMessage;
        }
        throw error;
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
}

// Data Fetching Functions
async function loadDashboardData() {
    if (!getCookie('adminToken')) return;
    
    try {
        showLoading();
        
        // Load all data in parallel
        const [pendingRequests, resolvedRequests, agents] = await Promise.all([
            fetchAllRequests(),
            fetchResolvedRequests(),
            fetchAgents()
        ]);
        
        // Update dashboard stats if needed
        updateDashboardStats({
            totalRequests: pendingRequests?.length || 0,
            resolvedRequests: resolvedRequests?.length || 0,
            activeAgents: agents?.filter(a => a.status === 'active')?.length || 0,
            totalAgents: agents?.length || 0
        });
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load dashboard data. ' + (error.message || ''));
    } finally {
        hideLoading();
    }
}

// Fetch and render resolved requests
async function fetchResolvedRequests() {
    try {
        const data = await fetchWithLogging('http://localhost:5000/api/resolved-requests', {
            headers: {
                'Authorization': 'Bearer ' + getCookie('adminToken')
            }
        });
        renderResolvedRequests(data);
        return data;
    } catch (error) {
        console.error('Error fetching resolved requests:', error);
        showError('Failed to load resolved requests. ' + (error.response?.data?.message || error.message));
        throw error;
    }
}

// Render Functions
function renderResolvedRequests(requests) {
    const tbody = document.querySelector('#resolved-requests-table tbody');
    if (!tbody) return;
    
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">No resolved requests found</td>
            </tr>
        `;
        return;
    }
    
    // Sort by timestamp in descending order (newest first)
    const sortedRequests = [...requests].sort((a, b) => 
        new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp)
    );
    
    tbody.innerHTML = sortedRequests.map(r => {
        const timestamp = r.updatedAt || r.timestamp;
        const status = r.status || 'resolved';
        const statusClass = status === 'resolved' ? 'success' : 'warning';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${escapeHtml(r.name || 'Guest')}</div>
                            <div class="text-sm text-gray-500">${r.email || 'No email'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${escapeHtml(r.query || 'No query')}</div>
                    ${r.mobile ? `<div class="text-sm text-gray-500">${r.mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        bg-${statusClass}-100 text-${statusClass}-800">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${timestamp ? formatDateTime(timestamp) : 'N/A'}
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${escapeHtml(r.resolutionNote) || 'No resolution note'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 view-details" data-id="${r._id}">
                        View Chat
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners for view chat buttons
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const requestId = e.target.closest('button').dataset.id;
            viewChatHistory(requestId);
        });
    });
}

function renderRequests(requests) {
    const tbody = document.querySelector('#requests-table tbody');
    if (!tbody) return;
    
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No active requests found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = requests.map(request => {
        const createdAt = request.createdAt ? formatDateTime(request.createdAt) : 'N/A';
        const status = request.status || 'pending';
        const statusClass = status.toLowerCase().replace(/\s+/g, '-');
        
        return `
            <tr>
                <td>${request.id || 'N/A'}</td>
                <td>${escapeHtml(request.userName) || 'Guest'}</td>
                <td>${escapeHtml(request.query) || 'No query'}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${createdAt}</td>
                <td>
                    ${status === 'pending' ? 
                        `<button class="btn btn-sm btn-primary resolve" data-id="${request.id}">Resolve</button>` : 
                        escapeHtml(request.resolutionNote) || 'N/A'}
                </td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners to resolve buttons
    document.querySelectorAll('.btn.resolve').forEach(btn => {
        btn.addEventListener('click', handleResolveRequest);
    });
}

function renderAgents(agents) {
    const tbody = document.querySelector('#agents-table tbody');
    if (!tbody) return;
    
    if (!agents || !Array.isArray(agents) || agents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No agents found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = agents.map(agent => {
        const lastActive = agent.lastActive ? formatDateTime(agent.lastActive) : 'Never';
        const status = agent.status || 'inactive';
        const statusClass = status.toLowerCase().replace(/\s+/g, '-');
        const activeChats = agent.activeChats || 0;
        
        return `
            <tr>
                <td>${escapeHtml(agent.name) || 'N/A'}</td>
                <td>${escapeHtml(agent.username) || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td><span class="badge bg-${activeChats > 0 ? 'primary' : 'secondary'}">${activeChats} active</span></td>
                <td>${lastActive}</td>
                <td class="text-nowrap">
                    <button class="btn btn-sm btn-outline-primary edit" data-id="${agent._id || agent.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete ms-1" data-id="${agent._id || agent.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn btn-sm btn-outline-warning change-password ms-1" data-id="${agent._id || agent.id}">
                        <i class="fas fa-key"></i> Reset
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners to action buttons
    document.querySelectorAll('.btn.edit').forEach(btn => {
        btn.addEventListener('click', handleEditAgent);
    });
    
    document.querySelectorAll('.btn.delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteAgent);
    });
    
    document.querySelectorAll('.btn.change-password').forEach(btn => {
        btn.addEventListener('click', handleChangePassword);
    });
}

async function handleChangePassword(e) {
    const agentId = e.target.dataset.id;
    const newPassword = prompt('Enter new password:');
    
    if (!newPassword) return;
    
    try {
        await fetchWithAuth(`/agents/${agentId}/change-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
        
        alert('Password updated successfully');
    } catch (error) {
        console.error('Failed to update password:', error);
        alert('Failed to update password: ' + (error.message || 'Unknown error'));
    }
}

// Event Handlers
async function handleResolveRequest(e) {
    const requestId = e.target.dataset.id;
    const note = prompt('Enter resolution note:');
    
    if (note === null) return; // User cancelled
    
    try {
        showLoading();
        await fetchWithLogging(`http://localhost:5000/api/requests/${requestId}/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getCookie('adminToken')
            },
            body: JSON.stringify({ note })
        });
        
        // Refresh all data
        await Promise.all([
            fetchAllRequests(),
            fetchResolvedRequests(),
            fetchAgents()
        ]);
        
        // Switch to resolved tab to show the updated list
        switchTab('resolved');
    } catch (error) {
        console.error('Failed to resolve request:', error);
        showError('Failed to resolve request: ' + (error.response?.data?.message || error.message));
    } finally {
        hideLoading();
    }
}

async function handleEditAgent(e) {
    const agentId = e.target.dataset.id;
    const newName = prompt('Enter new name:');
    
    if (!newName) return;
    
    try {
        await fetchWithAuth(`/agents/${agentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        // Refresh agents
        const agents = await fetchWithAuth('/agents');
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to update agent:', error);
    }
}

async function handleDeleteAgent(e) {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    
    const agentId = e.target.dataset.id;
    
    try {
        await fetchWithAuth(`/agents/${agentId}`, {
            method: 'DELETE'
        });
        
        // Refresh agents
        const agents = await fetchWithAuth('/agents');
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to delete agent:', error);
    }
}

function switchTab(tabId) {
    // Hide all panels
    const panels = {
        'all-requests': 'all-requests-panel',
        'resolved-requests': 'resolved-requests-panel',
        'agents': 'agents-panel'
    };
    
    // Hide all panels
    Object.values(panels).forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) panel.style.display = 'none';
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected panel
    const panelToShow = document.getElementById(panels[tabId]);
    if (panelToShow) panelToShow.style.display = 'block';
    
    // Activate selected tab
    const tabMap = {
        'all-requests': 'tab-all',
        'resolved-requests': 'tab-resolved',
        'agents': 'tab-agents'
    };
    const activeTab = document.getElementById(tabMap[tabId]);
    if (activeTab) activeTab.classList.add('active');
    
    // Load data when switching to certain tabs
    if (tabId === 'resolved-requests') {
        fetchResolvedRequests();
    } else if (tabId === 'agents') {
        fetchAgents();
    }
    
    // Update state
    state.currentTab = tabId;
}

// Auth Functions
async function checkAuth() {
    const token = getCookie('adminToken');
    if (!token) {
        showLogin();
        return false;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/admin/verify-token`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const data = await response.json();
        if (data.valid) {
            showDashboard();
            return true;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        deleteCookie('adminToken');
    }
    
    showLogin();
    return false;
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Login failed');
        }

        const data = await response.json();
        
        // Save token and admin data
        setCookie('adminToken', data.token, 1);
        if (data.admin) {
            setCookie('adminId', data.admin._id || data.admin.id, 1);
            setCookie('adminName', data.admin.name || 'Admin', 1);
        } else {
            setCookie('adminId', data.userId, 1);
            setCookie('adminName', 'Admin', 1);
        }
        
        showDashboard();
        loadDashboardData();
    } catch (error) {
        console.error('Login failed:', error);
        showError(error.message || 'Login failed. Please try again.');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    // Clear all admin-related cookies
    deleteCookie('adminToken');
    deleteCookie('adminId');
    deleteCookie('adminName');
    
    // Redirect to login
    showLogin();
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize UI elements
        initElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check authentication status
        showLoading();
        checkAuth()
            .then(authenticated => {
                if (authenticated) {
                    showDashboard();
                } else {
                    showLogin();
                }
            })
            .catch(error => {
                console.error('Auth check failed:', error);
                showError('Failed to check authentication status');
                showLogin();
            })
            .finally(hideLoading);
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
    }
});

function initElements() {
    // Initialize DOM elements
    elements.loginSection = document.getElementById('admin-login-section');
    elements.dashboardSection = document.getElementById('admin-dashboard-section');
    elements.loginForm = document.getElementById('adminLoginForm');
    elements.errorDiv = document.getElementById('loginError');
    elements.adminNameElement = document.getElementById('adminName');
    elements.adminStatusText = document.getElementById('adminStatusText');
    elements.logoutBtn = document.getElementById('adminLogoutBtn');
}

function setupEventListeners() {
    // Login form submission
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Tab switching
    document.getElementById('tab-all').addEventListener('click', () => switchTab('all-requests'));
    document.getElementById('tab-resolved').addEventListener('click', () => switchTab('resolved-requests'));
    document.getElementById('tab-agents').addEventListener('click', () => switchTab('agents'));
}
async function fetchAllRequests() {
    try {
        const data = await fetchWithAuth('/requests');
        const requests = Array.isArray(data) ? data : (data?.requests || []);
        renderRequestsTable(requests, document.querySelector('#all-requests-table tbody'));
        return requests;
    } catch (error) {
        console.error('Error fetching requests:', error);
        showError('Failed to load requests. ' + (error.message || 'Please try again later.'));
        renderRequestsTable([], document.querySelector('#all-requests-table tbody'));
        return [];
    }
}



// Fetch and render agents with enhanced error handling
async function fetchAgents() {
    try {
        const data = await fetchWithLogging('http://localhost:5000/api/agents', {
            headers: {
                'Authorization': 'Bearer ' + getCookie('adminToken')
            }
        });
        renderAgentsTable(data, document.querySelector('#agents-table tbody'));
        return data;
    } catch (error) {
        console.error('Error fetching agents:', error);
        showError('Failed to load agents. ' + (error.response?.data?.message || error.message));
        throw error;
    }
}

// Render all requests table
function renderRequestsTable(requests, tbody) {
    if (!tbody) {
        console.error('Table body element not found');
        return;
    }
    
    // Clear existing content
    tbody.innerHTML = '';
    
    if (!Array.isArray(requests) || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">No active requests found</td>
            </tr>
        `;
        return;
    }
    
    // Sort by timestamp in descending order (newest first)
    const sortedRequests = [...requests]
        .filter(request => request && (request.status !== 'resolved' || request.status === undefined))
        .sort((a, b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp));
    
    if (sortedRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">No active requests found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = sortedRequests.map(r => {
        const timestamp = r.updatedAt || r.timestamp;
        const status = r.status || 'pending';
        const statusClass = status === 'resolved' ? 'success' : 'warning';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${escapeHtml(r.name || 'Guest')}</div>
                            <div class="text-sm text-gray-500">${r.email || 'No email'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${escapeHtml(r.query || 'No query')}</div>
                    ${r.mobile ? `<div class="text-sm text-gray-500">${r.mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        bg-${statusClass}-100 text-${statusClass}-800">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${timestamp ? formatDateTime(timestamp) : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 resolve-request" data-id="${r._id || r.id}">
                        Resolve
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners for resolve buttons
    document.querySelectorAll('.resolve-request').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const requestId = e.target.closest('button').dataset.id;
            handleResolveRequest({ target: { dataset: { id: requestId } } });
        });
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

// Update dashboard statistics
function updateDashboardStats(stats) {
    const statsContainer = document.querySelector('.dashboard-stats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <h3>${stats.totalRequests || 0}</h3>
            <p>Active Requests</p>
        </div>
        <div class="stat-card">
            <h3>${stats.resolvedRequests || 0}</h3>
            <p>Resolved Today</p>
        </div>
        <div class="stat-card">
            <h3>${stats.activeAgents || 0}/${stats.totalAgents || 0}</h3>
            <p>Active Agents</p>
        </div>
    `;
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
