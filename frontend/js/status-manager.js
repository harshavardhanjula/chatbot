/**
 * Status Manager for Admin Dashboard
 * Handles admin status updates and UI interactions
 */

// Global status configuration
const statuses = [
    { id: 'online', label: 'Online', color: '#4caf50' },
    { id: 'away', label: 'Away', color: '#ff9800' },
    { id: 'busy', label: 'Busy', color: '#f44336' },
    { id: 'offline', label: 'Offline', color: '#9e9e9e' }
];

let currentStatus = localStorage.getItem('adminStatus') || 'online';

/**
 * Initialize status manager
 */
function initStatusManager() {
    setupStatusMenu();
    updateStatusDisplay();
    
    // Close status menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('statusMenu');
        if (menu && !menu.contains(e.target) && e.target.id !== 'adminStatusIndicator') {
            menu.classList.remove('show');
        }
    });
}

/**
 * Handle status indicator click
 */
function handleStatusIndicatorClick(e) {
    e.stopPropagation();
    const statusMenu = document.getElementById('statusMenu') || createStatusMenu();
    statusMenu.classList.toggle('show');
}

/**
 * Create status dropdown menu
 */
function createStatusMenu() {
    const menu = document.createElement('div');
    menu.id = 'statusMenu';
    menu.className = 'dropdown-menu dropdown-menu-end shadow';
    menu.setAttribute('aria-labelledby', 'adminStatusIndicator');
    
    // Add menu header
    const header = document.createElement('h6');
    header.className = 'dropdown-header';
    header.textContent = 'Update Status';
    menu.appendChild(header);
    
    // Add status options
    statuses.forEach(status => {
        const item = document.createElement('button');
        item.className = `dropdown-item d-flex align-items-center ${status.id === currentStatus ? 'active' : ''}`;
        
        const dot = document.createElement('span');
        dot.className = 'status-dot me-2';
        dot.style.backgroundColor = status.color;
        
        const text = document.createTextNode(status.label);
        
        item.appendChild(dot);
        item.appendChild(text);
        
        item.addEventListener('click', () => {
            setStatus(status.id);
            menu.classList.remove('show');
        });
        
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    return menu;
}

/**
 * Set admin status
 * @param {string} statusId - New status ID
 */
function setStatus(statusId) {
    if (statuses.some(s => s.id === statusId) && currentStatus !== statusId) {
        currentStatus = statusId;
        localStorage.setItem('adminStatus', statusId);
        updateStatusDisplay();
        updateStatusOnServer(statusId);
    }
}

/**
 * Update status display in the UI
 */
function updateStatusDisplay() {
    const status = statuses.find(s => s.id === currentStatus) || statuses[0];
    const statusIndicator = document.getElementById('adminStatusIndicator');
    
    if (statusIndicator) {
        let dot = statusIndicator.querySelector('.status-dot');
        let text = statusIndicator.querySelector('.status-text');
        
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'status-dot me-2';
            statusIndicator.prepend(dot);
        }
        
        if (!text) {
            text = document.createElement('span');
            text.className = 'status-text';
            statusIndicator.appendChild(text);
        }
        
        dot.style.backgroundColor = status.color;
        text.textContent = status.label;
    }
}

/**
 * Update status on server
 * @param {string} status - Status to set
 */
async function updateStatusOnServer(status) {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        
        // In a real app, this would call your backend API
        console.log('Updating status to:', status);
        /*
        await fetch('/api/admin/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        */
    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

/**
 * Setup status menu event listeners
 */
function setupStatusMenu() {
    const statusIndicator = document.getElementById('adminStatusIndicator');
    if (statusIndicator) {
        statusIndicator.addEventListener('click', handleStatusIndicatorClick);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatusManager);
} else {
    initStatusManager();
}

// Export functions for testing or manual initialization
window.StatusManager = {
    init: initStatusManager,
    setStatus,
    getCurrentStatus: () => currentStatus
};
