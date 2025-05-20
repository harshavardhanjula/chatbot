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

// Show loading state
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

// Hide loading state
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

// Utility functions
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + ';' + expires + ';path=/';
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
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
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

// UI Functions
/**
 * Show login form and hide dashboard
 */
function showLogin() {
    if (elements.loginSection) elements.loginSection.style.display = 'block';
    if (elements.dashboardSection) elements.dashboardSection.style.display = 'none';
    
    // Clear any sensitive data
    if (elements.loginForm) elements.loginForm.reset();
    if (elements.errorDiv) elements.errorDiv.style.display = 'none';
}

/**
 * Show dashboard and hide login form
 */
function showDashboard() {
    if (elements.loginSection) elements.loginSection.style.display = 'none';
    if (elements.dashboardSection) elements.dashboardSection.style.display = 'block';
    
    // Update admin info in the UI
    const adminName = getCookie('adminName');
    if (elements.adminNameElement) {
        elements.adminNameElement.textContent = adminName || 'Admin';
    }
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
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tab;
            switchTab(tabId);
        });
    });
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
        const data = await fetchWithAuth('/verify-token');
        if (data.valid) {
            showDashboard();
            loadDashboardData();
            return true;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
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
        const data = await fetchWithAuth('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        // Save token and admin data
        setCookie('adminToken', data.token, 1);
        setCookie('adminId', data.adminId, 1);
        setCookie('adminName', data.name || 'Admin', 1);
        
        showDashboard();
        loadDashboardData();
    } catch (error) {
        console.error('Login failed:', error);
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

// Dashboard Functions
async function loadDashboardData() {
    if (!getCookie('adminToken')) return;
    
    try {
        showLoading();
        
        // Load initial data
        const [requests, agents] = await Promise.all([
            fetchWithAuth('/requests'),
            fetchWithAuth('/agents')
        ]);
        
        renderRequests(requests);
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    } finally {
        hideLoading();
    }
}

function renderRequests(requests) {
    const tbody = document.querySelector('#requests-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = requests.map(request => `
        <tr>
            <td>${request.id}</td>
            <td>${request.userName || 'N/A'}</td>
            <td>${request.query || 'No query'}</td>
            <td><span class="status-badge ${request.status}">${request.status}</span></td>
            <td>${new Date(request.createdAt).toLocaleString()}</td>
            <td>
                ${request.status === 'pending' ? 
                    `<button class="btn-action resolve" data-id="${request.id}">Resolve</button>` : 
                    request.resolutionNote || 'N/A'}
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to resolve buttons
    document.querySelectorAll('.btn-action.resolve').forEach(btn => {
        btn.addEventListener('click', handleResolveRequest);
    });
}

function renderAgents(agents) {
    const tbody = document.querySelector('#agents-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = agents.map(agent => `
        <tr>
            <td>${agent.name || 'N/A'}</td>
            <td>${agent.username}</td>
            <td><span class="status-badge ${agent.status}">${agent.status}</span></td>
            <td>${agent.activeChats || 0}</td>
            <td>${new Date(agent.lastActive).toLocaleString()}</td>
            <td>
                <button class="btn-action edit" data-id="${agent.id}">Edit</button>
                <button class="btn-action delete" data-id="${agent.id}">Delete</button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to action buttons
    document.querySelectorAll('.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', handleEditAgent);
    });
    
    document.querySelectorAll('.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteAgent);
    });
}

// Event Handlers
async function handleResolveRequest(e) {
    const requestId = e.target.dataset.id;
    const note = prompt('Enter resolution note:');
    
    if (!note) return;
    
    try {
        await fetchWithAuth(`/requests/${requestId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ note })
        });
        
        // Refresh requests
        const requests = await fetchWithAuth('/admin/requests');
        renderRequests(requests);
    } catch (error) {
        console.error('Failed to resolve request:', error);
    }
}

async function handleEditAgent(e) {
    const agentId = e.target.dataset.id;
    const newName = prompt('Enter new name:');
    
    if (!newName) return;
    
    try {
        await fetchWithAuth(`/admin/agents/${agentId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: newName })
        });
        
        // Refresh agents
        const agents = await fetchWithAuth('/admin/agents');
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to update agent:', error);
    }
}

async function handleDeleteAgent(e) {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    
    const agentId = e.target.dataset.id;
    
    try {
        await fetchWithAuth(`/admin/agents/${agentId}`, {
            method: 'DELETE'
        });
        
        // Refresh agents
        const agents = await fetchWithAuth('/admin/agents');
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to delete agent:', error);
    }
}

function switchTab(tabId) {
    // Hide all panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected panel
    const panel = document.getElementById(`${tabId}-panel`);
    if (panel) panel.style.display = 'block';
    
    // Activate selected tab
    const tab = document.querySelector(`.admin-tab[data-tab="${tabId}"]`);
    if (tab) tab.classList.add('active');
    
    // Load data if needed
    if (tabId === 'requests') {
        loadRequests();
    } else if (tabId === 'agents') {
        loadAgents();
    }
}

// Helper function to load requests
async function loadRequests() {
    try {
        const requests = await fetchWithAuth('/admin/requests');
        renderRequests(requests);
    } catch (error) {
        console.error('Failed to load requests:', error);
    }
}

// Helper function to load agents
async function loadAgents() {
    try {
        const agents = await fetchWithAuth('/admin/agents');
        renderAgents(agents);
    } catch (error) {
        console.error('Failed to load agents:', error);
    }
}

function initElements() {
    try {
        loginSection = document.getElementById('admin-login-section');
        dashboardSection = document.getElementById('admin-dashboard-section');
        form = document.getElementById('adminLoginForm');
        errorDiv = document.getElementById('loginError');
        adminNameElement = document.getElementById('adminName');
        adminStatusText = document.getElementById('adminStatusText');
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
        logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
            adminStatusText = document.getElementById('adminStatusText');
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
            logoutBtn = document.getElementById('adminLogoutBtn');
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
    function loadInitialData(retryCount = 0) {
        const maxRetries = 3;
        
        const loadData = async () => {
            try {
                await Promise.all([
                    fetchAllRequests(),
                    fetchResolvedRequests(),
                    fetchAgents()
                ]);
                hideLoading();
            } catch (error) {
                console.error('Initial data load error:', error);
                if (retryCount < maxRetries) {
                    console.log(`Retrying... (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => loadInitialData(retryCount + 1), 1000 * (retryCount + 1));
                } else {
                    hideLoading();
                    alert('Failed to load dashboard data. Please refresh the page.');
                }
            }
        };
        
        // Small delay to ensure DOM is ready
        setTimeout(loadData, 100);
    }
    
    // Check for token and verify with server (optimized)
    async function checkAuth() {
        const token = getCookie('adminToken');
        const loginSection = document.getElementById('admin-login-section');
        const dashboardSection = document.getElementById('admin-dashboard-section');
        const loadingTimeout = setTimeout(showLoading, 300); // Only show loading if auth takes >300ms

        try {
            // Immediately show login if no token
            if (!token) {
                console.log('No admin token found in cookies');
                showLogin();
                return false;
            }

            // Verify token with server (with timeout)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            
            try {
                const response = await fetch('http://localhost:5000/api/admin/verify-token', {
                    signal: controller.signal,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    console.error('Token verification failed with status:', response.status);
                    throw new Error('Token verification failed');
                }
                
                const data = await response.json();
                if (!data.valid) {
                    console.error('Invalid token received from server');
                    throw new Error('Invalid token');
                }
                
                // Show dashboard immediately while loading data in background
                showDashboard();
                setAdminHeader(data.admin?.name || 'Admin');
                
                // Load critical data first, then load the rest
                await fetchAllRequests();
                
                // Load non-critical data in background
                Promise.all([
                    fetchResolvedRequests(),
                    fetchAgents()
                ]).catch(console.error);
                
                return true;
            } catch (fetchError) {
                console.error('Fetch error during token verification:', fetchError);
                throw fetchError;
            }
            
        } catch (error) {
            console.error('Auth check failed:', error);
            deleteCookie('adminToken');
            showLogin();
            return false;
        } finally {
            clearTimeout(loadingTimeout);
            hideLoading();
        }
    }

    // Initialize auth check
    // Start auth check immediately when script loads
const domContentLoaded = new Promise(resolve => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
    } else {
        resolve();
    }
});

// Start auth check in parallel with DOM loading
Promise.race([
    checkAuth(),
    domContentLoaded.then(() => checkAuth())
]).catch(console.error);

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

    // Optimized login form handler
    if (form) {
        let isSubmitting = false;
        
        // Remove any existing submit handlers to prevent duplicates
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Also prevent default on the button click
        const loginBtn = newForm.querySelector('#loginBtn');
        const errorDiv = document.getElementById('loginError');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                newForm.dispatchEvent(new Event('submit', { cancelable: true }));
            });
        }
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();  // Prevent any parent form handlers
            
            if (isSubmitting) return;
            
            const loginBtn = newForm.querySelector('#loginBtn');
            const usernameInput = newForm.querySelector('#username');
            const passwordInput = newForm.querySelector('#password');
            const showPasswordCheckbox = newForm.querySelector('#showPassword');
            
            // Clear previous errors and reset styles
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
                errorDiv.className = 'login-error';
            }
            
            // Remove any previous error states from inputs
            [usernameInput, passwordInput].forEach(input => {
                if (input) {
                    input.classList.remove('input-error');
                }
            });
            
            // Store original button state
            const originalBtnText = loginBtn ? loginBtn.innerHTML : 'Login';
            
            // Update UI to show loading state
            const setLoadingState = (isLoading) => {
                isSubmitting = isLoading;
                if (loginBtn) {
                    loginBtn.disabled = isLoading;
                    loginBtn.innerHTML = isLoading 
                        ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...'
                        : originalBtnText;
                }
            };
            
            // Get values
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            
            // Basic client-side validation
            if (!username || !password) {
                setLoadingState(false);
                if (errorDiv) {
                    errorDiv.textContent = '❌ Please enter both username and password';
                    errorDiv.style.display = 'block';
                    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                const targetInput = username ? passwordInput : usernameInput;
                if (targetInput) {
                    targetInput.focus();
                    targetInput.classList.add('input-error');
                    setTimeout(() => targetInput.classList.remove('input-error'), 2000);
                }
                return;
            }
            
            // Set loading state for API call
            setLoadingState(true);
            
            try {
                // Use AbortController for request timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                
                const startTime = performance.now();
                const res = await fetch('http://localhost:5000/api/admin/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ username, password }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const requestTime = Math.round(performance.now() - startTime);
                console.log(`Login request took ${requestTime}ms`);
                
                // Handle response
                if (res.ok) {
                    const data = await res.json();
                    // Store admin data in cookies
                    setCookie('adminToken', data.token, 1); // 1 day expiration
                    setCookie('adminId', data.admin.id, 1);
                    setCookie('adminName', data.admin?.username || 'Admin', 1);
                    
                    // Show success feedback
                    loginBtn.innerHTML = '✅ Success!';
                    
                    // Update admin header with username
                    const adminName = getAdminNameFromToken(data.token) || data.admin?.username || 'Admin';
                    setAdminHeader(adminName);
                    
                    // Show dashboard after successful login
                    showDashboard();
                    
                    // Notify server about admin login
                    if (socket && socket.connected) {
                        socket.emit('admin_login', {
                            adminId: data.admin.id,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Clear form
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                    
                } else {
                    const error = await res.json().catch(() => ({}));
                    const errorMessage = error.message || 'Login failed. Please check your credentials.';
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('Login error:', error);
                
                // Reset loading state
                setLoadingState(false);
                
                // Show error to user
                if (errorDiv) {
                    const errorMessage = error.name === 'AbortError' 
                        ? '❌ Request timed out. Please check your connection and try again.'
                        : `❌ ${error.message || 'An unexpected error occurred. Please try again.'}`;
                    
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Add shake animation
                    errorDiv.classList.add('shake-animation');
                    setTimeout(() => errorDiv.classList.remove('shake-animation'), 500);
                    
                    // Focus on the appropriate field with animation
                    try {
                        const targetInput = error.message && error.message.toLowerCase().includes('username') ? usernameInput : 
                                        error.message && error.message.toLowerCase().includes('password') ? passwordInput : 
                                        usernameInput;
                        
                        if (targetInput) {
                            targetInput.focus();
                            targetInput.classList.add('input-error');
                            setTimeout(() => targetInput.classList.remove('input-error'), 2000);
                        }
                    } catch (e) {
                        console.error('Error focusing input:', e);
                    }
                }
            }
        });
        
        // Add keyboard navigation
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !isSubmitting) {
                form.dispatchEvent(new Event('submit'));
            }
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

    // Enhanced fetch with better error handling
    async function fetchWithLogging(url, options = {}) {
        try {
            console.log(`Fetching: ${url}`, options);
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            const data = await response.json().catch(() => ({}));
            console.log(`Response from ${url}:`, { status: response.status, data });
            
            if (!response.ok) {
                const error = new Error(data.message || 'Network response was not ok');
                error.response = { status: response.status, data };
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error(`Error in fetch to ${url}:`, error);
            throw error; // Re-throw to be caught by the caller
        }
    }

    // Fetch and render all requests with enhanced error handling
    async function fetchAllRequests() {
        try {
            const data = await fetchWithLogging('http://localhost:5000/api/requests', {
                headers: {
                    'Authorization': 'Bearer ' + getCookie('adminToken')
                }
            });
            renderRequestsTable(data, document.querySelector('#all-requests-table tbody'));
            return data;
        } catch (error) {
            console.error('Error fetching requests:', error);
            showError('Failed to load requests. ' + (error.response?.data?.message || error.message));
            throw error;
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
            renderResolvedTable(data, document.querySelector('#resolved-requests-table tbody'));
            return data;
        } catch (error) {
            console.error('Error fetching resolved requests:', error);
            showError('Failed to load resolved requests. ' + (error.response?.data?.message || error.message));
            throw error;
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
}; // Close DOMContentLoaded event listener

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