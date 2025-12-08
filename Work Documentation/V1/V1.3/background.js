chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: true
  });
});

// Track blocked requests
let blockedUrls = [];
const MAX_STORED = 100;

// Load and parse the ABP filter list to check against
let filterPatterns = [];

// Load the filter list on extension install/startup
async function loadFilterList() {
  try {
    const response = await fetch(chrome.runtime.getURL('oisd_small_abp.txt'));
    const content = await response.text();
    const lines = content.split('\n');
    
    filterPatterns = [];
    
    for (const line of lines) {
      if (!line.trim() || line.startsWith('!') || line.startsWith('[') || 
          line.includes('##') || line.includes('#@#') || line.startsWith('@@')) {
        continue;
      }
      
      let filter = line.trim();
      if (filter.includes('$')) {
        filter = filter.split('$')[0];
      }
      filter = filter.replace(/^\|\|/, '').replace(/^\|/, '').replace(/\|$/, '');
      
      if (filter) {
        const pattern = filter.replace(/\*/g, '.*').replace(/\^/g, '');
        filterPatterns.push(pattern);
      }
    }
    console.log(`Loaded ${filterPatterns.length} filter patterns`);
  } catch (error) {
    console.error('Error loading filter list:', error);
  }
}

function matchesFilterList(url) {
  for (const pattern of filterPatterns) {
    if (url.includes(pattern.replace(/\.\*/g, ''))) {
      return true;
    }
  }
  return false;
}

function shortenUrl(url, maxLength = 100) {
  if (url.length <= maxLength) return url;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return url.substring(0, halfLength) + '...' + url.substring(url.length - halfLength);
}

// Simple heuristic to categorize blocked requests
function categorizeRequest(url) {
  const lower = url.toLowerCase();
  if (lower.match(/(track|analytics|pixel|beacon|telemetry|collect)/)) {
    return 'Tracker';
  }
  return 'Ad';
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    
    if (matchesFilterList(url)) {
      // Check if this specific URL + Tab combo was just logged to prevent spamming
      // Note: We now allow duplicates in the list if they are different timestamps/tabs for accurate counting
      const timestamp = new Date().toISOString();
      const shortenedUrl = shortenUrl(url, 100);
      const category = categorizeRequest(url);
      
      // Add tabId to the stored object so we can filter by current tab in the UI
      const newEntry = { 
        url: shortenedUrl, 
        fullUrl: url, 
        timestamp,
        tabId: details.tabId,
        category: category
      };

      blockedUrls.unshift(newEntry);
      
      if (blockedUrls.length > MAX_STORED) {
        blockedUrls = blockedUrls.slice(0, MAX_STORED);
      }
      
      chrome.storage.local.set({ blockedUrls });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ blockedUrls: [] });
  loadFilterList();
});

chrome.runtime.onStartup.addListener(() => {
  loadFilterList();
});

loadFilterList();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlockedUrls') {
    chrome.storage.local.get(['blockedUrls'], (result) => {
      sendResponse({ blockedUrls: result.blockedUrls || [] });
    });
    return true; 
  } else if (request.action === 'clearBlockedUrls') {
    blockedUrls = [];
    chrome.storage.local.set({ blockedUrls: [] });
    sendResponse({ success: true });
    return true;
  }
});