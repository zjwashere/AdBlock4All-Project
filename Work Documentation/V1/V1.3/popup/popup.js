// Existing logic...
function loadBlockedUrls() {
  chrome.runtime.sendMessage({ action: 'getBlockedUrls' }, (response) => {
    const blockedUrls = response.blockedUrls || [];
    displayBlockedUrls(blockedUrls);
  });
}

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
    // Added category to display
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
  chrome.runtime.sendMessage({ action: 'clearBlockedUrls' }, () => {
    loadBlockedUrls();
  });
});

// --- NEW CODE: Back Button Logic ---
const backBtn = document.getElementById('goBack');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'main.html';
  });
}

// Auto-refresh logic (same as before)
let refreshInterval;
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    loadBlockedUrls();
  }, 200);
}

loadBlockedUrls();
startAutoRefresh();

window.addEventListener('unload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});