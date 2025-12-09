// Get elements
const totalBlockedSetting = document.getElementById('totalBlockedSetting');
const logsCount = document.getElementById('logsCount');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const showBadgeToggle = document.getElementById('showBadgeToggle');
const goBackBtn = document.getElementById('goBack');

// Load current settings
function loadSettings() {
  chrome.storage.local.get(['totalBlockedAllTime', 'blockedUrlsByTab', 'showBadge'], (result) => {
    const total = result.totalBlockedAllTime || 0;
    const blockedUrlsByTab = result.blockedUrlsByTab || {};
    const showBadge = result.showBadge !== undefined ? result.showBadge : true;
    
    // Count total URLs across all tabs
    let totalUrls = 0;
    Object.values(blockedUrlsByTab).forEach(tabData => {
      totalUrls += (tabData.urls || []).length;
    });
    
    totalBlockedSetting.textContent = total.toLocaleString();
    logsCount.textContent = totalUrls;
    showBadgeToggle.checked = showBadge;
  });
}

// Clear logs only (keep total count)
clearLogsBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all recent logs from all tabs? Your total blocked count will be preserved.')) {
    chrome.storage.local.set({ blockedUrlsByTab: {} }, () => {
      showNotification('All recent logs cleared!');
      loadSettings();
    });
  }
});

// Reset all data
resetAllBtn.addEventListener('click', () => {
  if (confirm('⚠️ WARNING: This will reset ALL data including your total blocked count, achievements, and leaderboard rank. This cannot be undone. Are you sure?')) {
    const doubleCheck = confirm('This is your last chance! Reset everything?');
    if (doubleCheck) {
      chrome.runtime.sendMessage({ action: 'resetAllData' }, () => {
        showNotification('All data has been reset!');
        loadSettings();
      });
    }
  }
});

// Toggle badge display
showBadgeToggle.addEventListener('change', () => {
  const showBadge = showBadgeToggle.checked;
  chrome.storage.local.set({ showBadge }, () => {
    chrome.runtime.sendMessage({ action: 'updateBadge' });
    showNotification(showBadge ? 'Badge enabled' : 'Badge disabled');
  });
});

// Back button
goBackBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

// Show notification (simple visual feedback)
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}

// Auto-refresh stats
setInterval(loadSettings, 1000);

// Initial load
loadSettings();