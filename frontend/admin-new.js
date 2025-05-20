// Admin Dashboard JS
import socket from './socket.js';

// Global variables
let loginSection;
let dashboardSection;
let form;
let errorDiv;
let adminNameElement;
let adminStatusText;
let logoutBtn = null;
let isInitialLoad = true;

// Show loading state
function showLoading() {
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
        <p style="margin-top: 20px; font-size: 16px; color: #333;">Connecting to server...</p>
    `;
    document.body.appendChild(loadingDiv);
}

// Hide loading state
function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        loadingDiv.style.transition = 'opacity 0.3s';
        loadingDiv.style.opacity = '0';
        setTimeout(() => loadingDiv.remove(), 300);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show loading state immediately
    showLoading();
    
    try {
        // Initialize all DOM elements
        initElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check authentication status when the page loads
        checkAuth().then(authenticated => {
            if (authenticated) {
                showDashboard();
                loadInitialData();
            } else {
                showLogin();
            }
            hideLoading();
        }).catch(error => {
            console.error('Auth check error:', error);
            showLogin();
            hideLoading();
        });
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
    }
});

function initElements() {
    try {
        loginSection = document.getElementById('admin-login-section');
        dashboardSection = document.getElementById('admin-dashboard-section');
        form = document.getElementById('adminLoginForm');
        errorDiv = document.getElementById('loginError');
        adminNameElement = document.getElementById('adminName');
        adminStatusText = document.getElementById('adminStatusText');
        logoutBtn = document.getElementById('adminLogoutBtn');
    } catch (error) {
        console.error('Error initializing elements:', error);
        throw error;
    }
}

function setupEventListeners() {
    try {
        // Initialize form submission if form exists
        if (form) {
            form.addEventListener('submit', handleLogin);
        }
        
        // Initialize logout button if it exists
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Add tab click handlers
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', handleTabClick);
        });
    } catch (error) {
        console.error('Error setting up event listeners:', error);
        throw error;
    }
}

function showLogin() {
    try {
        if (loginSection) {
            loginSection.style.display = 'block';
        }
        if (dashboardSection) {
            dashboardSection.style.display = 'none';
        }
        updateAdminStatus('offline');
        hideLoading();
    } catch (error) {
        console.error('Error showing login:', error);
        hideLoading();
    }
}

function showDashboard() {
    try {
        if (loginSection) {
            loginSection.style.display = 'none';
        }
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
            // Update admin name in the dashboard header
            const adminName = getCookie('adminName');
            if (adminName && document.querySelector('.admin-header-admin-name')) {
                document.querySelector('.admin-header-admin-name').textContent = adminName;
            }
        }
        
        // Initialize dashboard with WebSocket connection
        initializeDashboard();
    } catch (error) {
        console.error('Error showing dashboard:', error);
        showLogin();
    }
}

function initializeDashboard() {
    const adminId = getCookie('adminId');
    if (!adminId) {
        showLogin();
        return;
    }

    // Connect to socket with admin ID
    socket.emit('admin_connect', {
        adminId: adminId,
        timestamp: new Date()
    });

    // Listen for updates
    socket.on('admin_update', (data) => {
        console.log('Admin update received:', data);
        // Refresh dashboard data when updates are received
        loadInitialData();
    });
    
    // Initial data load
    loadInitialData();
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

// Load initial data with retry logic
async function loadInitialData(retryCount = 0) {
    try {
        const maxRetries = 3;
        
        // Fetch all data in parallel
        await Promise.all([
            fetchAllRequests(),
            fetchResolvedRequests(),
            fetchAgents()
        ]);
        
        isInitialLoad = false;
    } catch (error) {
        console.error('Error loading initial data:', error);
        
        // Retry logic
        if (retryCount < maxRetries) {
            console.log(`Retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => loadInitialData(retryCount + 1), 2000);
        } else {
            console.error('Max retries reached. Could not load initial data.');
        }
    }
}

// Check for token and verify with server (optimized)
async function checkAuth() {
    const token = getCookie('adminToken');
    if (!token) {
        return false;
    }

    try {
        const response = await fetchWithLogging('/api/admin/verify-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.valid) {
                // Update admin name if available
                const adminName = getAdminNameFromToken(token);
                if (adminName) {
                    setAdminHeader(adminName);
                }
                return true;
            }
        }
    } catch (error) {
        console.error('Token verification error:', error);
    }
    
    // Clear invalid token
    deleteCookie('adminToken');
    return false;
}

// Parse JWT to get admin name (if available)
function getAdminNameFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.name || payload.username || 'Admin';
    } catch (error) {
        console.error('Error parsing token:', error);
        return null;
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const usernameInput = form.querySelector('input[type="text"]');
    const passwordInput = form.querySelector('input[type="password"]');
    
    if (!usernameInput || !passwordInput) {
        console.error('Login form inputs not found');
        return;
    }
    
    // Set loading state
    setLoadingState(true);
    
    try {
        // Get values
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        // Basic validation
        if (!username || !password) {
            throw new Error('Please enter both username and password');
        }
        
        // Make login request
        const response = await fetchWithLogging('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Save token and admin info
        setCookie('adminToken', data.token, 1); // 1 day expiration
        setCookie('adminId', data.adminId, 1);
        setCookie('adminName', data.name || 'Admin', 1);
        
        // Update UI
        showDashboard();
        loadInitialData();
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Show error message
        if (errorDiv) {
            errorDiv.textContent = error.message || 'An error occurred during login';
            errorDiv.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            }, 5000);
        }
    } finally {
        // Reset loading state
        setLoadingState(false);
    }
}

// Handle logout
function handleLogout() {
    // Clear all admin-related cookies
    deleteCookie('adminToken');
    deleteCookie('adminId');
    deleteCookie('adminName');
    
    // Redirect to login page
    window.location.href = '/admin';
}

// Handle tab clicks
function handleTabClick(event) {
    const tabId = event.target.id;
    const panels = ['all-requests-panel', 'resolved-requests-panel', 'agents-panel'];
    const tabs = document.querySelectorAll('.admin-tab');
    
    // Update active tab
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show corresponding panel
    panels.forEach(panel => {
        const panelElement = document.getElementById(panel);
        if (panelElement) {
            panelElement.style.display = panel === `${tabId.replace('tab-', '')}-panel` ? 'block' : 'none';
        }
    });
    
    // Load data for the selected tab if needed
    if (tabId === 'tab-all') {
        fetchAllRequests();
    } else if (tabId === 'tab-resolved') {
        fetchResolvedRequests();
    } else if (tabId === 'tab-agents') {
        fetchAgents();
    }
}

// Update UI to show loading state
function setLoadingState(isLoading) {
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    if (submitButton) {
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Login';
        }
    }
}

// Enhanced fetch with better error handling
async function fetchWithLogging(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP error ${response.status} for ${url}:`, errorText);
            throw new Error(`Request failed with status ${response.status}`);
        }
        
        return response;
    } catch (error) {
        console.error(`Error in fetch for ${url}:`, error);
        throw error;
    }
}

// Fetch and render all requests with enhanced error handling
async function fetchAllRequests() {
    try {
        const response = await fetchWithLogging('/api/admin/requests');
        const requests = await response.json();
        const tbody = document.querySelector('#all-requests-table tbody');
        if (tbody) {
            renderRequestsTable(requests, tbody);
        }
    } catch (error) {
        console.error('Error fetching all requests:', error);
        // You might want to show an error message to the user here
    }
}

// Fetch and render resolved requests
async function fetchResolvedRequests() {
    try {
        const response = await fetchWithLogging('/api/admin/requests/resolved');
        const requests = await response.json();
        const tbody = document.querySelector('#resolved-requests-table tbody');
        if (tbody) {
            renderResolvedTable(requests, tbody);
        }
    } catch (error) {
        console.error('Error fetching resolved requests:', error);
    }
}

// Fetch and render agents with enhanced error handling
async function fetchAgents() {
    try {
        const response = await fetchWithLogging('/api/admin/agents');
        const agents = await response.json();
        const tbody = document.querySelector('#agents-table tbody');
        if (tbody) {
            renderAgentsTable(agents, tbody);
        }
    } catch (error) {
        console.error('Error fetching agents:', error);
    }
}

// Render all requests table
function renderRequestsTable(requests, tbody) {
    tbody.innerHTML = '';
    
    requests.forEach(request => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${request.userName || 'N/A'}</td>
            <td>${request.query || 'No query provided'}</td>
            <td><span class="status-badge status-${request.status || 'pending'}">${request.status || 'Pending'}</span></td>
            <td>${new Date(request.timestamp).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary">View</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render resolved requests table
function renderResolvedTable(requests, tbody) {
    tbody.innerHTML = '';
    
    requests.forEach(request => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${request.userName || 'N/A'}</td>
            <td>${request.query || 'No query provided'}</td>
            <td><span class="status-badge status-${request.status || 'resolved'}">${request.status || 'Resolved'}</span></td>
            <td>${new Date(request.timestamp).toLocaleString()}</td>
            <td>${request.resolutionNote || 'No notes'}</td>
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
            <td>${agent.name || 'N/A'}</td>
            <td>${agent.username || 'N/A'}</td>
            <td><span class="status-badge status-${agent.status || 'offline'}">${agent.status || 'Offline'}</span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteAgent('${agent.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Cookie utility functions
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
}

function getCookie(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}
