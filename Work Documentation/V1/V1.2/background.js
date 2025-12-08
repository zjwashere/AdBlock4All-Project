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
      // Skip comments, empty lines, and element hiding rules
      if (!line.trim() || line.startsWith('!') || line.startsWith('[') || 
          line.includes('##') || line.includes('#@#') || line.startsWith('@@')) {
        continue;
      }
      
      let filter = line.trim();
      
      // Remove options
      if (filter.includes('$')) {
        filter = filter.split('$')[0];
      }
      
      // Process the filter
      filter = filter.replace(/^\|\|/, '').replace(/^\|/, '').replace(/\|$/, '');
      
      if (filter) {
        // Convert to a simple pattern check (not perfect but works for tracking)
        const pattern = filter.replace(/\*/g, '.*').replace(/\^/g, '');
        filterPatterns.push(pattern);
      }
    }
    
    console.log(`Loaded ${filterPatterns.length} filter patterns`);
  } catch (error) {
    console.error('Error loading filter list:', error);
  }
}

// Check if URL matches any filter pattern
function matchesFilterList(url) {
  // Simple substring matching for common patterns
  for (const pattern of filterPatterns) {
    if (url.includes(pattern.replace(/\.\*/g, ''))) {
      return true;
    }
  }
  return false;
}

// Shorten URL to max length
function shortenUrl(url, maxLength = 100) {
  if (url.length <= maxLength) {
    return url;
  }
  
  const halfLength = Math.floor((maxLength - 3) / 2);
  return url.substring(0, halfLength) + '...' + url.substring(url.length - halfLength);
}

// Monitor web requests to identify blocked ones
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    
    // Check if this URL matches our filter list
    const isBlocked = matchesFilterList(url);
    
    if (isBlocked) {
      // Check if this URL already exists in the list
      const urlExists = blockedUrls.some(item => item.url === url);
      
      if (!urlExists) {
        const timestamp = new Date().toISOString();
        const shortenedUrl = shortenUrl(url, 100);
        
        blockedUrls.unshift({ url: shortenedUrl, fullUrl: url, timestamp });
        
        // Keep only recent entries
        if (blockedUrls.length > MAX_STORED) {
          blockedUrls = blockedUrls.slice(0, MAX_STORED);
        }
        
        // Store in chrome.storage for popup access
        chrome.storage.local.set({ blockedUrls });
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Initialize storage and load filter list
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ blockedUrls: [] });
  loadFilterList();
});

// Load filter list on startup
chrome.runtime.onStartup.addListener(() => {
  loadFilterList();
});

// Load immediately when service worker starts
loadFilterList();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlockedUrls') {
    chrome.storage.local.get(['blockedUrls'], (result) => {
      sendResponse({ blockedUrls: result.blockedUrls || [] });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'clearBlockedUrls') {
    blockedUrls = [];
    chrome.storage.local.set({ blockedUrls: [] });
    sendResponse({ success: true });
    return true;
  }
});