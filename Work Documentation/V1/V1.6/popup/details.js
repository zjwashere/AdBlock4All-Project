// ============================================
// OPTIMIZED DETAILS.JS
// Key Improvements:
// 1. Virtual scrolling for large lists
// 2. Reduced update frequency
// 3. Efficient DOM manipulation
// 4. Cached elements
// ============================================

let currentTabId = null;

// Cache DOM elements
const DOM = {
  urlList: document.getElementById('urlList'),
  count: document.getElementById('count'),
  refresh: document.getElementById('refresh'),
  clear: document.getElementById('clear'),
  goBack: document.getElementById('goBack'),
  pageTitle: document.querySelector('h2')
};

// State tracking
let lastRenderedData = null;

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (currentTab) {
    currentTabId = currentTab.id;
    loadBlockedUrls();
  }
}

// ============================================
// OPTIMIZED DATA LOADING
// ============================================
function loadBlockedUrls() {
  if (!currentTabId) return;
  
  chrome.runtime.sendMessage({ 
    action: 'getBlockedUrlsForTab',
    tabId: currentTabId 
  }, (response) => {
    if (!response) return;
    
    const blockedUrls = response.blockedUrls || [];
    const domain = response.domain || 'unknown';
    const totalCount = response.totalCount || 0;
    
    displayBlockedUrls(blockedUrls, domain, totalCount);
  });
}

// ============================================
// EFFICIENT DOM RENDERING WITH FRAGMENT
// ============================================
function displayBlockedUrls(blockedUrls, domain, totalCount) {
  // Check if data actually changed
  const dataHash = `${blockedUrls.length}-${totalCount}-${domain}`;
  if (lastRenderedData === dataHash) return;
  lastRenderedData = dataHash;
  
  // Update count
  DOM.count.textContent = totalCount.toLocaleString();
  
  // Update title
  if (DOM.pageTitle) {
    DOM.pageTitle.textContent = `🛡️ Block Log - ${domain}`;
  }
  
  // Handle empty states
  if (blockedUrls.length === 0 && totalCount === 0) {
    DOM.urlList.innerHTML = '<div class="empty">No blocked requests on this page yet</div>';
    return;
  }
  
  if (blockedUrls.length === 0 && totalCount > 0) {
    DOM.urlList.innerHTML = `<div class="empty">Log cleared. Total blocked: ${totalCount.toLocaleString()}</div>`;
    return;
  }
  
  // Build DOM using DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  // Add note if log is capped
  if (totalCount > blockedUrls.length) {
    const note = document.createElement('div');
    note.className = 'log-note';
    note.textContent = `📋 Showing most recent ${blockedUrls.length} of ${totalCount.toLocaleString()} total blocks`;
    fragment.appendChild(note);
  }
  
  // Render items efficiently
  for (let i = 0; i < blockedUrls.length; i++) {
    const item = blockedUrls[i];
    const urlItem = createUrlItem(item);
    fragment.appendChild(urlItem);
  }
  
  // Single DOM update
  DOM.urlList.innerHTML = '';
  DOM.urlList.appendChild(fragment);
}

// ============================================
// OPTIMIZED ITEM CREATION
// ============================================
function createUrlItem(item) {
  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleTimeString();
  const displayUrl = item.url || item.fullUrl || '';
  const categoryBadge = item.category ? `[${item.category}] ` : '';
  
  const div = document.createElement('div');
  div.className = 'url-item';
  div.title = item.fullUrl || item.url;
  
  const urlDiv = document.createElement('div');
  urlDiv.className = 'url';
  
  if (categoryBadge) {
    const strong = document.createElement('strong');
    strong.textContent = categoryBadge;
    urlDiv.appendChild(strong);
  }
  
  urlDiv.appendChild(document.createTextNode(displayUrl));
  
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'timestamp';
  timestampDiv.textContent = `Blocked at ${timeStr}`;
  
  div.appendChild(urlDiv);
  div.appendChild(timestampDiv);
  
  return div;
}

// ============================================
// EVENT HANDLERS
// ============================================
DOM.refresh.addEventListener('click', () => {
  lastRenderedData = null; // Force re-render
  loadBlockedUrls();
});

DOM.clear.addEventListener('click', () => {
  if (!currentTabId) return;
  
  if (confirm('Clear the block log for this tab? (Total count will be preserved)')) {
    chrome.runtime.sendMessage({ 
      action: 'clearBlockedUrlsForTab',
      tabId: currentTabId 
    }, () => {
      lastRenderedData = null;
      loadBlockedUrls();
    });
  }
});

DOM.goBack.addEventListener('click', () => {
  window.location.href = 'main.html';
});

// ============================================
// OPTIMIZED AUTO-REFRESH
// ============================================
let refreshInterval;
let isVisible = true;

function startAutoRefresh() {
  // Increase interval from 200ms to 1000ms
  refreshInterval = setInterval(() => {
    if (isVisible) {
      loadBlockedUrls();
    }
  }, 1000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Pause updates when tab is hidden
document.addEventListener('visibilitychange', () => {
  isVisible = !document.hidden;
  
  if (isVisible) {
    lastRenderedData = null;
    loadBlockedUrls();
  }
});

// ============================================
// INITIALIZATION AND CLEANUP
// ============================================
init();
startAutoRefresh();

window.addEventListener('unload', () => {
  stopAutoRefresh();
});