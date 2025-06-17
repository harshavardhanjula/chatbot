// Admin Dashboard JS
// Simple admin dashboard implementation
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin dashboard initialized');
    
    // Main application state
    const state = {
        adminToken: localStorage.getItem('adminToken'),
        adminData: JSON.parse(localStorage.getItem('adminData') || '{}')
    };
    
    // Get all required DOM elements
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutButton');
    const showPasswordCheckbox = document.getElementById('showPassword');
    const passwordInput = document.getElementById('password');
    const adminName = document.getElementById('adminName');
    const adminAvatar = document.getElementById('adminAvatar');
    const loginWrapper = document.getElementById('adminLoginWrapper');
    
    // Initialize the application
    function initApp() {
        console.log('Initializing admin dashboard...');
        
        // Initialize event listeners
        initEventListeners();
        
        // Check if user is already logged in
        checkAdminSession();
        
        // Initialize UI components
        initUIComponents();
        
        console.log('Admin dashboard initialized');
    }
    
    // Initialize event listeners
    function initEventListeners() {
        console.log('Initializing event listeners...');
        
        // Toggle password visibility
        if (showPasswordCheckbox && passwordInput) {
            showPasswordCheckbox.addEventListener('change', (e) => {
                passwordInput.type = e.target.checked ? 'text' : 'password';
            });
        }
        
        // Login form submission
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
    
    // Initialize UI components
    function initUIComponents() {
        console.log('Initializing UI components...');
        setupTabSwitching();
        setupAutoRefresh(30000); // 30 seconds
    }
    
    // Check admin session
    function checkAdminSession() {
        console.log('Checking admin session...');
        
        if (state.adminToken) {
            // User is logged in, show dashboard
            console.log('User is logged in, showing dashboard');
            showDashboard();
        } else {
            // Not logged in, show login form
            console.log('User is not logged in, showing login form');
            showLogin();
        }
    }
    
    // Show login form
    function showLogin() {
        console.log('showLogin() called');
        
        // Clear any existing error messages
        if (loginError) {
            loginError.style.display = 'none';
            loginError.textContent = '';
        }
        
        // Show login section
        if (loginSection) {
            console.log('Showing login section');
            loginSection.style.display = 'flex';
        } else {
            console.error('loginSection element not found!');
        }
        
        // Hide dashboard section
        if (dashboardSection) {
            console.log('Hiding dashboard section');
            dashboardSection.style.display = 'none';
        } else {
            console.error('dashboardSection element not found!');
        }
        
        // Reset login form
        if (loginForm) loginForm.reset();
    }
    
    // Show dashboard
    function showDashboard() {
        console.log('showDashboard() called');
        
        try {
            console.log('Admin data from state:', state.adminData);
            
            // Hide login and show dashboard
            if (loginSection) {
                console.log('Hiding login section');
                loginSection.style.display = 'none';
            } else {
                console.error('loginSection element not found!');
            }
            
            if (dashboardSection) {
                console.log('Showing dashboard section');
                dashboardSection.style.display = 'block';
            } else {
                console.error('dashboardSection element not found!');
            }
            
            // Update admin info in the dashboard
            updateAdminInfo();
            
        } catch (error) {
            console.error('Error showing dashboard:', error);
            showError('Failed to load dashboard. Please try again.');
            showLogin();
        }
    }
    
    // Update admin info in the UI
    function updateAdminInfo() {
        if (adminName) {
            adminName.textContent = state.adminData.name || 'Admin';
        }
        
        if (adminAvatar && state.adminData.name) {
            adminAvatar.textContent = state.adminData.name.charAt(0).toUpperCase();
        }
    }
    
    // Handle login
    async function handleLogin(e) {
        console.log('=== Login form submission started ===');
        
        if (e) {
            e.preventDefault();
            console.log('Default form submission prevented');
        }
        
        // Get form values
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberMeInput = document.getElementById('rememberMe');
        const loginBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
        
        if (!usernameInput || !passwordInput || !loginBtn) {
            console.error('Required form elements not found!');
            showError('Form elements not properly initialized. Please refresh the page.');
            return;
        }
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeInput ? rememberMeInput.checked : false;
        const originalBtnText = loginBtn.innerHTML;
        
        try {
            // Show loading state
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            
            // Validate inputs
            if (!username || !password) {
                throw new Error('Please enter both username and password');
            }
            
            // Simulate API call
            console.log('Simulating login API call...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Store dummy data
            state.adminData = {
                id: 'admin-001',
                name: username.charAt(0).toUpperCase() + username.slice(1),
                email: `${username.toLowerCase()}@example.com`,
                role: 'admin'
            };
            
            state.adminToken = 'dummy-jwt-token';
            
            // Update localStorage
            localStorage.setItem('adminToken', state.adminToken);
            localStorage.setItem('adminData', JSON.stringify(state.adminData));
            
            // Show success message
            if (typeof Swal !== 'undefined') {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', Swal.stopTimer);
                        toast.addEventListener('mouseleave', Swal.resumeTimer);
                    }
                });
                
                await Toast.fire({
                    icon: 'success',
                    title: 'Signed in successfully'
                });
            }
            
            // Show dashboard
            showDashboard();
            
        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'An error occurred during login');
        } finally {
            // Reset login button
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnText;
            }
        }
    }
    
    // Handle logout
    function handleLogout() {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Logout',
                text: 'Are you sure you want to logout?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, logout',
                cancelButtonText: 'Cancel',
                reverseButtons: true
            }).then((result) => {
                if (result.isConfirmed) {
                    performLogout();
                }
            });
        } else {
            if (confirm('Are you sure you want to logout?')) {
                performLogout();
            }
        }
    }
    
    // Perform the actual logout
    function performLogout() {
        // Clear state and localStorage
        state.adminToken = null;
        state.adminData = {};
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        
        // Show login form
        showLogin();
        
        // Show success message if Swal is available
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Logged Out',
                text: 'You have been successfully logged out.',
                timer: 2000,
                showConfirmButton: false
            });
        }
    }
    
    // Show error message
    function showError(message) {
        console.error('Error:', message);
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
            
            // Auto-hide error after 5 seconds
            setTimeout(() => {
                if (loginError) {
                    loginError.style.display = 'none';
                }
            }, 5000);
        }
    }
    
    // Setup tab switching
    function setupTabSwitching() {
        console.log('Setting up tab switching...');
        
        const tabAll = document.getElementById('tab-all');
        const tabResolved = document.getElementById('tab-resolved');
        const tabAgents = document.getElementById('tab-agents');
        const allPanel = document.getElementById('all-requests-panel');
        const resolvedPanel = document.getElementById('resolved-requests-panel');
        const agentsPanel = document.getElementById('agents-panel');
        
        if (!tabAll || !tabResolved || !tabAgents || !allPanel || !resolvedPanel || !agentsPanel) {
            console.warn('Some tab elements not found. Tab switching may not work correctly.');
            return;
        }
        
        // Helper function to switch tabs
        function switchToTab(activeTab, activePanel) {
            // Remove active class from all tabs and panels
            [tabAll, tabResolved, tabAgents].forEach(tab => tab.classList.remove('active'));
            [allPanel, resolvedPanel, agentsPanel].forEach(panel => panel.style.display = 'none');
            
            // Activate the selected tab and panel
            activeTab.classList.add('active');
            activePanel.style.display = 'block';
        }
        
        // Add event listeners
        tabAll.addEventListener('click', () => switchToTab(tabAll, allPanel));
        tabResolved.addEventListener('click', () => switchToTab(tabResolved, resolvedPanel));
        tabAgents.addEventListener('click', () => switchToTab(tabAgents, agentsPanel));
        
        // Activate the first tab by default
        switchToTab(tabAll, allPanel);
    }
    
    // Setup auto-refresh
    function setupAutoRefresh(interval) {
        console.log('Setting up auto-refresh with interval:', interval);
        
        // Clear any existing interval
        if (window.refreshIntervalId) {
            clearInterval(window.refreshIntervalId);
        }
        
        // Set up new interval
        window.refreshIntervalId = setInterval(() => {
            console.log('Refreshing dashboard data...');
            // Add your data refresh logic here
        }, interval);
    }
    
    // Initialize the application
    initApp();
});
