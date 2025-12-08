// Load and display blocked URLs
function loadBlockedUrls() {
  chrome.runtime.sendMessage({ action: 'getBlockedUrls' }, (response) => {
    const blockedUrls = response.blockedUrls || [];
    displayBlockedUrls(blockedUrls);
  });
}

// Display blocked URLs in the popup
function displayBlockedUrls(blockedUrls) {
  const urlList = document.getElementById('urlList');
  const count = document.getElementById('count');
  
  count.textContent = blockedUrls.length;
  
  if (blockedUrls.length === 0) {
    urlList.innerHTML = '<div class="empty">No blocked requests yet</div>';
    return;
  }
  
  urlList.innerHTML = blockedUrls.map(item => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString();
    const displayUrl = item.url || item.fullUrl || '';
    
    return `
      <div class="url-item" title="${escapeHtml(item.fullUrl || item.url)}">
        <div class="url">${escapeHtml(displayUrl)}</div>
        <div class="timestamp">Blocked at ${timeStr}</div>
      </div>
    `;
  }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Refresh button
document.getElementById('refresh').addEventListener('click', () => {
  loadBlockedUrls();
});

// Clear button
document.getElementById('clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearBlockedUrls' }, () => {
    loadBlockedUrls();
  });
});

// Auto-refresh every 1 second
let refreshInterval;

function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    loadBlockedUrls();
  }, 1000);
}

// Load on popup open and start auto-refresh
loadBlockedUrls();
startAutoRefresh();

// Clean up interval when popup closes
window.addEventListener('unload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});