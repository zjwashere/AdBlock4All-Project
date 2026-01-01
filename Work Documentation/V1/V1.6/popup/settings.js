// ============================================
// OPTIMIZED SETTINGS.JS
// Key Improvements:
// 1. Reduced polling frequency
// 2. Event-driven updates
// 3. Cached state
// ============================================

// Cache DOM elements
const DOM = {
  totalBlockedSetting: document.getElementById('totalBlockedSetting'),
  logsCount: document.getElementById('logsCount'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),
  resetAllBtn: document.getElementById('resetAllBtn'),
  showBadgeToggle: document.getElementById('showBadgeToggle'),
  goBackBtn: document.getElementById('goBack')
};

// State tracking
let lastSettings = {
  totalBlocked: -1,
  logsCount: -1,
  showBadge: true
};

// ============================================
// LOAD SETTINGS
// ============================================
function loadSettings() {
  chrome.storage.local.get(['totalBlockedAllTime', 'blockedUrlsByTab', 'showBadge'], (result) => {
    const total = result.totalBlockedAllTime || 0;
    const blockedUrlsByTab = result.blockedUrlsByTab || {};
    const showBadge = result.showBadge !== false;
    
    // Count total URLs
    let totalUrls = 0;
    Object.values(blockedUrlsByTab).forEach(tabData => {
      totalUrls += (tabData.urls || []).length;
    });
    
    // Only update if changed
    if (lastSettings.totalBlocked !== total) {
      DOM.totalBlockedSetting.textContent = total.toLocaleString();
      lastSettings.totalBlocked = total;
    }
    
    if (lastSettings.logsCount !== totalUrls) {
      DOM.logsCount.textContent = totalUrls;
      lastSettings.logsCount = totalUrls;
    }
    
    if (lastSettings.showBadge !== showBadge) {
      DOM.showBadgeToggle.checked = showBadge;
      lastSettings.showBadge = showBadge;
    }
  });
}

// ============================================
// CLEAR LOGS
// ============================================
DOM.clearLogsBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all recent logs from all tabs? Your total blocked count will be preserved.')) {
    chrome.storage.local.set({ blockedUrlsByTab: {} }, () => {
      showNotification('All recent logs cleared!');
      lastSettings.logsCount = -1; // Force update
      loadSettings();
    });
  }
});

// ============================================
// RESET ALL DATA
// ============================================
DOM.resetAllBtn.addEventListener('click', () => {
  if (confirm('⚠️ WARNING: This will reset ALL data including your total blocked count, achievements, and leaderboard rank. This cannot be undone. Are you sure?')) {
    const doubleCheck = confirm('This is your last chance! Reset everything?');
    if (doubleCheck) {
      chrome.runtime.sendMessage({ action: 'resetAllData' }, () => {
        showNotification('All data has been reset!');
        // Force full refresh
        lastSettings = { totalBlocked: -1, logsCount: -1, showBadge: true };
        loadSettings();
      });
    }
  }
});

// ============================================
// TOGGLE BADGE
// ============================================
DOM.showBadgeToggle.addEventListener('change', () => {
  const showBadge = DOM.showBadgeToggle.checked;
  chrome.storage.local.set({ showBadge }, () => {
    chrome.runtime.sendMessage({ action: 'updateBadge' });
    showNotification(showBadge ? 'Badge enabled' : 'Badge disabled');
    lastSettings.showBadge = showBadge;
  });
});

// ============================================
// BACK BUTTON
// ============================================
DOM.goBackBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

// ============================================
// NOTIFICATION SYSTEM
// ============================================
let notificationTimeout = null;

function showNotification(message) {
  // Remove existing notification
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }
  
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  // Auto-hide
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 2000);
}

// ============================================
// OPTIMIZED AUTO-REFRESH
// ============================================
let refreshInterval;

function startAutoRefresh() {
  // Reduced frequency from 1000ms to 3000ms
  refreshInterval = setInterval(loadSettings, 3000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Pause when hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
    loadSettings();
  }
});

// ============================================
// INITIALIZATION
// ============================================
loadSettings();
startAutoRefresh();

window.addEventListener('unload', () => {
  stopAutoRefresh();
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
});