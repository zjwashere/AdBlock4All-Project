// Load blocked URLs for the current tab
let currentTabId = null;

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (currentTab) {
    currentTabId = currentTab.id;
    loadBlockedUrls();
  }
}

function loadBlockedUrls() {
  if (!currentTabId) return;
  
  chrome.runtime.sendMessage({ 
    action: 'getBlockedUrlsForTab',
    tabId: currentTabId 
  }, (response) => {
    const blockedUrls = response.blockedUrls || [];
    const domain = response.domain || 'unknown';
    const totalCount = response.totalCount || 0;
    displayBlockedUrls(blockedUrls, domain, totalCount);
  });
}

function displayBlockedUrls(blockedUrls, domain, totalCount) {
  const urlList = document.getElementById('urlList');
  const count = document.getElementById('count');
  
  // Show total count (not just logs length)
  count.textContent = totalCount.toLocaleString();
  
  // Update page title to show domain and total count
  const pageTitle = document.querySelector('h2');
  if (pageTitle) {
    pageTitle.textContent = `🛡️ Block Log - ${domain}`;
  }
  
  if (blockedUrls.length === 0 && totalCount === 0) {
    urlList.innerHTML = '<div class="empty">No blocked requests on this page yet</div>';
    return;
  }
  
  if (blockedUrls.length === 0 && totalCount > 0) {
    urlList.innerHTML = `<div class="empty">Log cleared. Total blocked: ${totalCount.toLocaleString()}</div>`;
    return;
  }
  
  // Show note if log is capped
  let headerNote = '';
  if (totalCount > blockedUrls.length) {
    headerNote = `<div class="log-note">📝 Showing most recent ${blockedUrls.length} of ${totalCount.toLocaleString()} total blocks</div>`;
  }
  
  urlList.innerHTML = headerNote + blockedUrls.map(item => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString();
    const displayUrl = item.url || item.fullUrl || '';
    const categoryBadge = item.category ? `[${item.category}] ` : '';
    
    return `
      <div class="url-item" title="${escapeHtml(item.fullUrl || item.url)}">
        <div class="url"><strong>${categoryBadge}</strong>${escapeHtml(displayUrl)}</div>
        <div class="timestamp">Blocked at ${timeStr}</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById('refresh').addEventListener('click', () => {
  loadBlockedUrls();
});

document.getElementById('clear').addEventListener('click', () => {
  if (!currentTabId) return;
  
  if (confirm('Clear the block log for this tab? (Total count will be preserved)')) {
    chrome.runtime.sendMessage({ 
      action: 'clearBlockedUrlsForTab',
      tabId: currentTabId 
    }, () => {
      loadBlockedUrls();
    });
  }
});

// Back Button Logic
const backBtn = document.getElementById('goBack');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'main.html';
  });
}

// Auto-refresh logic
let refreshInterval;
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    loadBlockedUrls();
  }, 200);
}

init();
startAutoRefresh();

window.addEventListener('unload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});