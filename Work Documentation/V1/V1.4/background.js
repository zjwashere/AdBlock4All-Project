chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: false // We'll manually set the badge
  });
});

// Track blocked requests per tab
let blockedUrlsByTab = {}; // Structure: { tabId: { domain: string, urls: [...], totalCount: number } }
const MAX_STORED_PER_TAB = 100;

// Track total all-time blocks
let totalBlockedAllTime = 0;

// Load and parse the ABP filter list to check against
let filterPatterns = [];

// Update badge for a specific tab
function updateBadgeForTab(tabId) {
  chrome.storage.local.get(['showBadge'], (result) => {
    const showBadge = result.showBadge !== undefined ? result.showBadge : true;
    
    if (showBadge && blockedUrlsByTab[tabId]) {
      const count = blockedUrlsByTab[tabId].totalCount || 0;
      
      if (count > 0) {
        const badgeText = count >= 1000000 ? (count / 1000000).toFixed(1) + 'M' :
                          count >= 1000 ? (count / 1000).toFixed(1) + 'K' :
                          count.toString();
        chrome.action.setBadgeText({ text: badgeText, tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#e74c3c', tabId: tabId });
      } else {
        chrome.action.setBadgeText({ text: '', tabId: tabId });
      }
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  });
}

// Update badge with total count (for settings or general use)
function updateBadge() {
  chrome.storage.local.get(['totalBlockedAllTime', 'showBadge'], (result) => {
    const total = result.totalBlockedAllTime || 0;
    const showBadge = result.showBadge !== undefined ? result.showBadge : true;
    
    if (showBadge && total > 0) {
      const badgeText = total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' :
                        total >= 1000 ? (total / 1000).toFixed(1) + 'K' :
                        total.toString();
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

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

// Get domain from tab
async function getTabDomain(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    return url.hostname;
  } catch (e) {
    return 'unknown';
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const url = details.url;
    const tabId = details.tabId;
    
    if (matchesFilterList(url)) {
      const timestamp = new Date().toISOString();
      const shortenedUrl = shortenUrl(url, 100);
      const category = categorizeRequest(url);
      const domain = await getTabDomain(tabId);
      
      const newEntry = { 
        url: shortenedUrl, 
        fullUrl: url, 
        timestamp,
        tabId: tabId,
        domain: domain,
        category: category
      };

      // Initialize tab storage if needed
      if (!blockedUrlsByTab[tabId]) {
        blockedUrlsByTab[tabId] = {
          domain: domain,
          urls: [],
          totalCount: 0
        };
      }
      
      // Add to tab-specific list
      blockedUrlsByTab[tabId].urls.unshift(newEntry);
      
      // Increment the total count for this tab
      blockedUrlsByTab[tabId].totalCount = (blockedUrlsByTab[tabId].totalCount || 0) + 1;
      
      // Keep only recent entries per tab (limit the log size)
      if (blockedUrlsByTab[tabId].urls.length > MAX_STORED_PER_TAB) {
        blockedUrlsByTab[tabId].urls = blockedUrlsByTab[tabId].urls.slice(0, MAX_STORED_PER_TAB);
      }
      
      // Save to storage
      chrome.storage.local.set({ blockedUrlsByTab }, () => {
        // Increment total all-time counter
        chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
          totalBlockedAllTime = (result.totalBlockedAllTime || 0) + 1;
          chrome.storage.local.set({ 
            totalBlockedAllTime 
          }, () => {
            // Update badge for this specific tab
            updateBadgeForTab(tabId);
          });
        });
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (blockedUrlsByTab[tabId]) {
    delete blockedUrlsByTab[tabId];
    chrome.storage.local.set({ blockedUrlsByTab });
  }
});

// Clean up when tab URL changes significantly (new domain)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    try {
      const newUrl = new URL(changeInfo.url);
      const newDomain = newUrl.hostname;
      
      // If domain changed, clear that tab's blocked list
      if (blockedUrlsByTab[tabId] && blockedUrlsByTab[tabId].domain !== newDomain) {
        blockedUrlsByTab[tabId] = {
          domain: newDomain,
          urls: [],
          totalCount: 0
        };
        chrome.storage.local.set({ blockedUrlsByTab });
        updateBadgeForTab(tabId);
      }
    } catch (e) {
      // Invalid URL, clear badge
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

// Update badge when switching tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage but preserve totalBlockedAllTime if it exists
  chrome.storage.local.get(['totalBlockedAllTime', 'showBadge'], (result) => {
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: result.totalBlockedAllTime || 0,
      showBadge: result.showBadge !== undefined ? result.showBadge : true
    }, () => {
      // Update badges for all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          updateBadgeForTab(tab.id);
        });
      });
    });
  });
  loadFilterList();
});

chrome.runtime.onStartup.addListener(() => {
  loadFilterList();
  // Load blockedUrlsByTab from storage and update badges for all tabs
  chrome.storage.local.get(['blockedUrlsByTab'], (result) => {
    blockedUrlsByTab = result.blockedUrlsByTab || {};
    
    // Update badge for all open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        updateBadgeForTab(tab.id);
      });
    });
  });
});

loadFilterList();

// Load initial state and update badges
chrome.storage.local.get(['blockedUrlsByTab'], (result) => {
  blockedUrlsByTab = result.blockedUrlsByTab || {};
  
  // Update badge for all open tabs on extension load
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      updateBadgeForTab(tab.id);
    });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlockedUrlsForTab') {
    const tabId = request.tabId;
    const tabData = blockedUrlsByTab[tabId];
    
    if (tabData) {
      sendResponse({ 
        blockedUrls: tabData.urls || [],
        domain: tabData.domain,
        totalCount: tabData.totalCount || 0
      });
    } else {
      sendResponse({ 
        blockedUrls: [],
        domain: 'unknown',
        totalCount: 0
      });
    }
    return true;
  } else if (request.action === 'clearBlockedUrlsForTab') {
    const tabId = request.tabId;
    
    if (blockedUrlsByTab[tabId]) {
      // Clear the URLs array but keep the totalCount
      blockedUrlsByTab[tabId].urls = [];
      chrome.storage.local.set({ blockedUrlsByTab }, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: true });
    }
    return true;
  } else if (request.action === 'getTotalBlocked') {
    chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
      sendResponse({ total: result.totalBlockedAllTime || 0 });
    });
    return true;
  } else if (request.action === 'resetAllData') {
    // Reset everything
    blockedUrlsByTab = {};
    totalBlockedAllTime = 0;
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: 0,
      userRank: 1
    }, () => {
      // Clear badges for all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        });
      });
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'updateBadge') {
    // Update badge for the requesting tab or all tabs
    if (request.tabId) {
      updateBadgeForTab(request.tabId);
    } else {
      // Update all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          updateBadgeForTab(tab.id);
        });
      });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getAllBlockedUrls') {
    // For settings page - get all URLs from all tabs
    const allUrls = [];
    Object.values(blockedUrlsByTab).forEach(tabData => {
      allUrls.push(...tabData.urls);
    });
    sendResponse({ blockedUrls: allUrls });
    return true;
  }
});