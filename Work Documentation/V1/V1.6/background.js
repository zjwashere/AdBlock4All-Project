// [Keep all the existing Trie and Cache code from the original background.js]
// ... (TrieNode, FilterTrie, LRUCache classes remain the same)

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isPattern = false;
    this.category = null;
  }
}

class FilterTrie {
  constructor() {
    this.root = new TrieNode();
    this.patternCount = 0;
  }

  insert(pattern, category = 'Ad') {
    let node = this.root;
    const cleanPattern = this._cleanPattern(pattern);
    
    for (const char of cleanPattern) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    
    node.isPattern = true;
    node.category = category;
    this.patternCount++;
  }

  _cleanPattern(pattern) {
    return pattern
      .replace(/^\|\|/, '')
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .replace(/\*/g, '')
      .replace(/\^/g, '')
      .toLowerCase();
  }

  matches(url) {
    const cleanUrl = url.toLowerCase();
    
    for (let i = 0; i < cleanUrl.length; i++) {
      const result = this._searchFrom(cleanUrl, i);
      if (result) return result;
    }
    
    return null;
  }

  _searchFrom(url, startIdx) {
    let node = this.root;
    
    for (let i = startIdx; i < url.length && node; i++) {
      const char = url[i];
      
      if (node.isPattern) {
        return { matched: true, category: node.category };
      }
      
      node = node.children.get(char);
    }
    
    return node?.isPattern ? { matched: true, category: node.category } : null;
  }
}

class LRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }
}

const filterTrie = new FilterTrie();
const urlCache = new LRUCache(1000);
const blockedUrlsByTab = new Map();
const MAX_STORED_PER_TAB = 100;

let pendingStorageUpdates = false;
let storageUpdateTimer = null;
const STORAGE_BATCH_DELAY = 500;
const badgeUpdateTimers = new Map();
const BADGE_UPDATE_DELAY = 300;

// XP and Coins configuration
const XP_PER_AD = 10;
const COINS_PER_AD = 5;

async function loadFilterList() {
  console.time('FilterList Load');
  
  try {
    const response = await fetch(chrome.runtime.getURL('oisd_small_abp.txt'));
    const content = await response.text();
    const lines = content.split('\n');
    
    let loaded = 0;
    const categorizers = [
      { regex: /(track|analytics|pixel|beacon|telemetry|collect)/i, category: 'Tracker' },
      { regex: /(ad|banner|popup|sponsor)/i, category: 'Ad' }
    ];
    
    for (const line of lines) {
      if (!line.trim() || line.startsWith('!') || line.startsWith('[') || 
          line.includes('##') || line.includes('#@#') || line.startsWith('@@')) {
        continue;
      }
      
      let filter = line.trim();
      if (filter.includes('$')) {
        filter = filter.split('$')[0];
      }
      
      if (!filter) continue;
      
      let category = 'Ad';
      for (const cat of categorizers) {
        if (cat.regex.test(filter)) {
          category = cat.category;
          break;
        }
      }
      
      filterTrie.insert(filter, category);
      loaded++;
    }
    
    console.timeEnd('FilterList Load');
    console.log(`Loaded ${loaded} patterns`);
  } catch (error) {
    console.error('Error loading filter list:', error);
  }
}

function checkUrlBlocked(url) {
  if (urlCache.has(url)) {
    return urlCache.get(url);
  }
  
  const result = filterTrie.matches(url);
  urlCache.set(url, result);
  
  return result;
}

const shortenUrl = (() => {
  const cache = new Map();
  const MAX_CACHE = 500;
  
  return (url, maxLength = 100) => {
    if (cache.has(url)) return cache.get(url);
    
    let shortened;
    if (url.length <= maxLength) {
      shortened = url;
    } else {
      const halfLength = Math.floor((maxLength - 3) / 2);
      shortened = url.substring(0, halfLength) + '...' + url.substring(url.length - halfLength);
    }
    
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(url, shortened);
    return shortened;
  };
})();

function scheduleBatchedStorageUpdate() {
  if (storageUpdateTimer) {
    clearTimeout(storageUpdateTimer);
  }
  
  pendingStorageUpdates = true;
  
  storageUpdateTimer = setTimeout(() => {
    if (pendingStorageUpdates) {
      flushStorageUpdates();
    }
  }, STORAGE_BATCH_DELAY);
}

function flushStorageUpdates() {
  pendingStorageUpdates = false;
  
  const dataToStore = {};
  blockedUrlsByTab.forEach((value, key) => {
    dataToStore[key] = value;
  });
  
  chrome.storage.local.set({ blockedUrlsByTab: dataToStore });
}

function updateBadgeForTab(tabId) {
  if (badgeUpdateTimers.has(tabId)) {
    clearTimeout(badgeUpdateTimers.get(tabId));
  }
  
  const timer = setTimeout(() => {
    chrome.storage.local.get(['showBadge', 'adBlockerEnabled'], (result) => {
      const showBadge = result.showBadge !== false;
      const enabled = result.adBlockerEnabled !== false;
      
      // Set icon based on enabled state
      if (!enabled) {
        chrome.action.setIcon({ 
          path: 'icons/tempIcon_grey.png',
          tabId 
        });
        chrome.action.setBadgeText({ text: '', tabId });
        return;
      } else {
        chrome.action.setIcon({ 
          path: 'icons/tempIcon.png',
          tabId 
        });
      }
      
      // Show current tab's blocked count
      if (showBadge && blockedUrlsByTab.has(tabId)) {
        const count = blockedUrlsByTab.get(tabId).totalCount || 0;
        
        if (count > 0) {
          const badgeText = count >= 1000000 ? (count / 1000000).toFixed(1) + 'M' :
                            count >= 1000 ? (count / 1000).toFixed(1) + 'K' :
                            count.toString();
          chrome.action.setBadgeText({ text: badgeText, tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#f44336', tabId });
        } else {
          chrome.action.setBadgeText({ text: '', tabId });
        }
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
    });
    
    badgeUpdateTimers.delete(tabId);
  }, BADGE_UPDATE_DELAY);
  
  badgeUpdateTimers.set(tabId, timer);
}

// Award XP and Coins for blocking ads
function awardXPAndCoins() {
  chrome.storage.local.get(['userXP', 'userCoins'], (result) => {
    const newXP = (result.userXP || 0) + XP_PER_AD;
    const newCoins = (result.userCoins || 0) + COINS_PER_AD;
    
    chrome.storage.local.set({
      userXP: newXP,
      userCoins: newCoins
    });
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { url, tabId } = details;
    
    if (tabId < 0) return;
    
    // Check if ad blocker is enabled
    chrome.storage.local.get(['adBlockerEnabled'], (result) => {
      const enabled = result.adBlockerEnabled !== false;
      
      if (!enabled) {
        return; // Don't block if disabled
      }
      
      const matchResult = checkUrlBlocked(url);
      
      if (matchResult?.matched) {
        const timestamp = Date.now();
        const shortenedUrl = shortenUrl(url, 100);
        const category = matchResult.category || 'Ad';
        
        if (!blockedUrlsByTab.has(tabId)) {
          blockedUrlsByTab.set(tabId, {
            domain: '',
            urls: [],
            totalCount: 0
          });
        }
        
        const tabData = blockedUrlsByTab.get(tabId);
        
        const newEntry = { 
          url: shortenedUrl, 
          fullUrl: url, 
          timestamp,
          category
        };
        
        tabData.urls.unshift(newEntry);
        
        if (tabData.urls.length > MAX_STORED_PER_TAB) {
          tabData.urls.length = MAX_STORED_PER_TAB;
        }
        
        tabData.totalCount++;
        
        scheduleBatchedStorageUpdate();
        
        // Increment total and award XP/Coins
        chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
          const newTotal = (result.totalBlockedAllTime || 0) + 1;
          chrome.storage.local.set({ totalBlockedAllTime: newTotal });
        });
        
        awardXPAndCoins();
        updateBadgeForTab(tabId);
      }
    });
  },
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  blockedUrlsByTab.delete(tabId);
  
  if (badgeUpdateTimers.has(tabId)) {
    clearTimeout(badgeUpdateTimers.get(tabId));
    badgeUpdateTimers.delete(tabId);
  }
  
  scheduleBatchedStorageUpdate();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    try {
      const newUrl = new URL(changeInfo.url);
      const newDomain = newUrl.hostname;
      
      if (blockedUrlsByTab.has(tabId)) {
        const tabData = blockedUrlsByTab.get(tabId);
        
        if (tabData.domain !== newDomain) {
          blockedUrlsByTab.set(tabId, {
            domain: newDomain,
            urls: [],
            totalCount: 0
          });
          scheduleBatchedStorageUpdate();
          updateBadgeForTab(tabId);
        }
      }
    } catch (e) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: false
  });
  
  chrome.storage.local.get([
    'totalBlockedAllTime', 
    'showBadge', 
    'userXP', 
    'userCoins', 
    'userLevel',
    'ownedAvatars',
    'equippedAvatar',
    'adBlockerEnabled'
  ], (result) => {
    const totalBlocked = result.totalBlockedAllTime || 0;
    const enabled = result.adBlockerEnabled !== false;
    
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: totalBlocked,
      showBadge: result.showBadge !== false,
      userXP: result.userXP !== undefined ? result.userXP : totalBlocked * XP_PER_AD,
      userCoins: result.userCoins !== undefined ? result.userCoins : totalBlocked * COINS_PER_AD,
      userLevel: result.userLevel || 1,
      ownedAvatars: result.ownedAvatars || ['avatar_default'],
      equippedAvatar: result.equippedAvatar || '👤',
      adBlockerEnabled: enabled
    });
    
    // Set initial icon state
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (enabled) {
          chrome.action.setIcon({ 
            path: 'icons/tempIcon.png',
            tabId: tab.id 
          });
        } else {
          chrome.action.setIcon({ 
            path: 'icons/tempIcon_grey.png',
            tabId: tab.id 
          });
        }
      });
    });
  });
  
  loadFilterList();
});

chrome.runtime.onStartup.addListener(() => {
  loadFilterList();
  
  chrome.storage.local.get(['blockedUrlsByTab'], (result) => {
    const stored = result.blockedUrlsByTab || {};
    
    blockedUrlsByTab.clear();
    Object.entries(stored).forEach(([tabId, data]) => {
      blockedUrlsByTab.set(parseInt(tabId), data);
    });
    
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => updateBadgeForTab(tab.id));
    });
  });
});

loadFilterList();
chrome.storage.local.get(['blockedUrlsByTab'], (result) => {
  const stored = result.blockedUrlsByTab || {};
  Object.entries(stored).forEach(([tabId, data]) => {
    blockedUrlsByTab.set(parseInt(tabId), data);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlockedUrlsForTab') {
    const tabId = request.tabId;
    const tabData = blockedUrlsByTab.get(tabId);
    
    if (tabData) {
      const urls = tabData.urls.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString()
      }));
      
      sendResponse({ 
        blockedUrls: urls,
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
    
    if (blockedUrlsByTab.has(tabId)) {
      const tabData = blockedUrlsByTab.get(tabId);
      tabData.urls = [];
      scheduleBatchedStorageUpdate();
    }
    
    sendResponse({ success: true });
    return true;
    
  } else if (request.action === 'getTotalBlocked') {
    chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
      sendResponse({ total: result.totalBlockedAllTime || 0 });
    });
    return true;
    
  } else if (request.action === 'toggleAdBlocker') {
    const enabled = request.enabled;
    chrome.storage.local.set({ adBlockerEnabled: enabled }, () => {
      // Update all tab badges and icons
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (enabled) {
            chrome.action.setIcon({ 
              path: 'icons/tempIcon.png',
              tabId: tab.id 
            });
            updateBadgeForTab(tab.id);
          } else {
            chrome.action.setIcon({ 
              path: 'icons/tempIcon_grey.png',
              tabId: tab.id 
            });
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
          }
        });
      });
      sendResponse({ success: true });
    });
    return true;
    
  } else if (request.action === 'resetAllData') {
    blockedUrlsByTab.clear();
    urlCache.cache.clear();
    
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: 0,
      userRank: 1,
      userXP: 0,
      userCoins: 0,
      userLevel: 1,
      ownedAvatars: ['avatar_default'],
      equippedAvatar: '👤'
    }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        });
      });
      sendResponse({ success: true });
    });
    return true;
    
  } else if (request.action === 'updateBadge') {
    if (request.tabId) {
      updateBadgeForTab(request.tabId);
    } else {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => updateBadgeForTab(tab.id));
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

self.addEventListener('unload', () => {
  if (pendingStorageUpdates) {
    flushStorageUpdates();
  }
});