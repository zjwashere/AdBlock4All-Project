// ============================================
// OPTIMIZED BACKGROUND.JS
// Key Improvements:
// 1. Reduced memory usage with better caching
// 2. Batched operations for better performance
// 3. Optimized Trie structure
// 4. Efficient event handling
// 5. Added time saved and data saved tracking
// 6. Added daily streak tracking
// ============================================

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

// ============================================
// OPTIMIZED STATE MANAGEMENT
// ============================================
const filterTrie = new FilterTrie();
const urlCache = new LRUCache(2000);
const blockedUrlsByTab = new Map();
const MAX_STORED_PER_TAB = 50;

// Batching configuration
let pendingStorageUpdates = new Set();
let storageUpdateTimer = null;
const STORAGE_BATCH_DELAY = 1000;

// Badge updates - debounced per tab
const badgeUpdateTimers = new Map();
const BADGE_UPDATE_DELAY = 500;

// XP and Coins configuration
const XP_PER_AD = 3;
const COINS_PER_AD = 1;

// Time and Data saved calculations
const AVG_TIME_PER_AD = 0.12; // 0.12 seconds per ad
const AVG_DATA_PER_AD = 50; // 50 KB per ad

// ============================================
// DAILY STREAK TRACKING
// ============================================
function checkAndUpdateStreak() {
  chrome.storage.local.get(['dailyStreak', 'lastActiveDate', 'adBlockerEnabled'], (result) => {
    const enabled = result.adBlockerEnabled !== false;
    if (!enabled) return;

    const today = new Date().toDateString();
    const lastActive = result.lastActiveDate || '';
    
    if (lastActive === today) {
      return; // Already updated today
    }
    
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newStreak = result.dailyStreak || 0;
    
    if (lastActive === yesterday) {
      // Continue streak
      newStreak++;
    } else if (lastActive === '') {
      // First time
      newStreak = 1;
    } else {
      // Streak broken
      newStreak = 1;
    }
    
    chrome.storage.local.set({
      dailyStreak: newStreak,
      lastActiveDate: today
    });
  });
}

// Check streak on first block of the day
let streakCheckedToday = false;

// ============================================
// OPTIMIZED FILTER LOADING
// ============================================
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
    
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE);
      
      for (const line of chunk) {
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
      
      if (i + CHUNK_SIZE < lines.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.timeEnd('FilterList Load');
    console.log(`Loaded ${loaded} patterns`);
  } catch (error) {
    console.error('Error loading filter list:', error);
  }
}

// ============================================
// OPTIMIZED URL CHECKING
// ============================================
function checkUrlBlocked(url) {
  if (urlCache.has(url)) {
    return urlCache.get(url);
  }
  
  const result = filterTrie.matches(url);
  urlCache.set(url, result);
  
  return result;
}

// ============================================
// URL SHORTENING WITH CACHE
// ============================================
const urlShortener = (() => {
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

// ============================================
// BATCHED STORAGE UPDATES
// ============================================
function scheduleBatchedStorageUpdate(tabId) {
  pendingStorageUpdates.add(tabId);
  
  if (storageUpdateTimer) {
    return;
  }
  
  storageUpdateTimer = setTimeout(() => {
    flushStorageUpdates();
    storageUpdateTimer = null;
  }, STORAGE_BATCH_DELAY);
}

function flushStorageUpdates() {
  if (pendingStorageUpdates.size === 0) return;
  
  const dataToStore = {};
  pendingStorageUpdates.forEach(tabId => {
    if (blockedUrlsByTab.has(tabId)) {
      dataToStore[tabId] = blockedUrlsByTab.get(tabId);
    }
  });
  
  chrome.storage.local.set({ blockedUrlsByTab: dataToStore });
  pendingStorageUpdates.clear();
}

// ============================================
// DEBOUNCED BADGE UPDATES
// ============================================
function updateBadgeForTab(tabId) {
  if (badgeUpdateTimers.has(tabId)) {
    clearTimeout(badgeUpdateTimers.get(tabId));
  }
  
  const timer = setTimeout(() => {
    chrome.storage.local.get(['showBadge', 'adBlockerEnabled'], (result) => {
      const showBadge = result.showBadge !== false;
      const enabled = result.adBlockerEnabled !== false;
      
      const iconPath = enabled ? 'icons/tempIcon.png' : 'icons/tempIcon_grey.png';
      chrome.action.setIcon({ path: iconPath, tabId });
      
      if (!enabled || !showBadge) {
        chrome.action.setBadgeText({ text: '', tabId });
        return;
      }
      
      if (blockedUrlsByTab.has(tabId)) {
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

// ============================================
// BATCHED XP/COINS UPDATES
// ============================================
let xpCoinsUpdateTimer = null;
let pendingXPCoins = { xp: 0, coins: 0 };

function awardXPAndCoins() {
  pendingXPCoins.xp += XP_PER_AD;
  pendingXPCoins.coins += COINS_PER_AD;
  
  if (xpCoinsUpdateTimer) {
    return;
  }
  
  xpCoinsUpdateTimer = setTimeout(() => {
    const { xp, coins } = pendingXPCoins;
    
    chrome.storage.local.get(['userXP', 'userCoins'], (result) => {
      chrome.storage.local.set({
        userXP: (result.userXP || 0) + xp,
        userCoins: (result.userCoins || 0) + coins
      });
    });
    
    pendingXPCoins = { xp: 0, coins: 0 };
    xpCoinsUpdateTimer = null;
  }, 1000);
}

// ============================================
// WEB REQUEST HANDLER
// ============================================
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { url, tabId } = details;
    
    if (tabId < 0) return;
    
    chrome.storage.local.get(['adBlockerEnabled'], (result) => {
      if (result.adBlockerEnabled === false) return;
      
      // Check streak on first block
      if (!streakCheckedToday) {
        checkAndUpdateStreak();
        streakCheckedToday = true;
      }
      
      const matchResult = checkUrlBlocked(url);
      
      if (matchResult?.matched) {
        const timestamp = Date.now();
        const shortenedUrl = urlShortener(url, 100);
        const category = matchResult.category || 'Ad';
        
        if (!blockedUrlsByTab.has(tabId)) {
          blockedUrlsByTab.set(tabId, {
            domain: '',
            urls: [],
            totalCount: 0
          });
        }
        
        const tabData = blockedUrlsByTab.get(tabId);
        
        if (tabData.urls.length < MAX_STORED_PER_TAB) {
          tabData.urls.unshift({ 
            url: shortenedUrl, 
            fullUrl: url, 
            timestamp,
            category
          });
        }
        
        tabData.totalCount++;
        
        scheduleBatchedStorageUpdate(tabId);
        
        // Update total blocked and statistics
        chrome.storage.local.get([
          'totalBlockedAllTime',
          'totalTimeSaved',
          'totalDataSaved'
        ], (result) => {
          const newTotal = (result.totalBlockedAllTime || 0) + 1;
          const newTimeSaved = ((result.totalTimeSaved || 0) + AVG_TIME_PER_AD).toFixed(2);
          const newDataSaved = (result.totalDataSaved || 0) + AVG_DATA_PER_AD;
          
          chrome.storage.local.set({ 
            totalBlockedAllTime: newTotal,
            totalTimeSaved: newTimeSaved,
            totalDataSaved: newDataSaved
          });
        });
        
        awardXPAndCoins();
        updateBadgeForTab(tabId);
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// ============================================
// TAB EVENT HANDLERS
// ============================================
chrome.tabs.onRemoved.addListener((tabId) => {
  blockedUrlsByTab.delete(tabId);
  pendingStorageUpdates.delete(tabId);
  
  if (badgeUpdateTimers.has(tabId)) {
    clearTimeout(badgeUpdateTimers.get(tabId));
    badgeUpdateTimers.delete(tabId);
  }
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
          scheduleBatchedStorageUpdate(tabId);
          updateBadgeForTab(tabId);
        }
      } else {
        // Initialize with domain
        blockedUrlsByTab.set(tabId, {
          domain: newDomain,
          urls: [],
          totalCount: 0
        });
      }
    } catch (e) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

// ============================================
// INITIALIZATION
// ============================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: false
  });
  
  chrome.storage.local.get([
    'totalBlockedAllTime',
    'totalTimeSaved',
    'totalDataSaved',
    'showBadge',
    'userXP',
    'userCoins',
    'userLevel',
    'ownedAvatars',
    'equippedAvatar',
    'adBlockerEnabled',
    'dailyStreak',
    'lastActiveDate'
  ], (result) => {
    const totalBlocked = result.totalBlockedAllTime || 0;
    const enabled = result.adBlockerEnabled !== false;
    
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: totalBlocked,
      totalTimeSaved: result.totalTimeSaved || totalBlocked * AVG_TIME_PER_AD,
      totalDataSaved: result.totalDataSaved || totalBlocked * AVG_DATA_PER_AD,
      showBadge: result.showBadge !== false,
      userXP: result.userXP !== undefined ? result.userXP : totalBlocked * XP_PER_AD,
      userCoins: result.userCoins !== undefined ? result.userCoins : totalBlocked * COINS_PER_AD,
      userLevel: result.userLevel || 1,
      ownedAvatars: result.ownedAvatars || ['avatar_default'],
      equippedAvatar: result.equippedAvatar || '👤',
      adBlockerEnabled: enabled,
      dailyStreak: result.dailyStreak || 0,
      lastActiveDate: result.lastActiveDate || ''
    });
    
    const iconPath = enabled ? 'icons/tempIcon.png' : 'icons/tempIcon_grey.png';
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.action.setIcon({ path: iconPath, tabId: tab.id });
      });
    });
  });
  
  loadFilterList();
});

chrome.runtime.onStartup.addListener(() => {
  loadFilterList();
  streakCheckedToday = false;
  
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

// Reset streak check daily
setInterval(() => {
  streakCheckedToday = false;
}, 86400000); // 24 hours

// ============================================
// MESSAGE HANDLERS
// ============================================
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
        domain: '',
        totalCount: 0
      });
    }
    return true;
    
  } else if (request.action === 'clearBlockedUrlsForTab') {
    const tabId = request.tabId;
    
    if (blockedUrlsByTab.has(tabId)) {
      const tabData = blockedUrlsByTab.get(tabId);
      tabData.urls = [];
      scheduleBatchedStorageUpdate(tabId);
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
    const iconPath = enabled ? 'icons/tempIcon.png' : 'icons/tempIcon_grey.png';
    
    chrome.storage.local.set({ adBlockerEnabled: enabled }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.action.setIcon({ path: iconPath, tabId: tab.id });
          if (enabled) {
            updateBadgeForTab(tab.id);
          } else {
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
    pendingStorageUpdates.clear();
    
    chrome.storage.local.set({ 
      blockedUrlsByTab: {},
      totalBlockedAllTime: 0,
      totalTimeSaved: 0,
      totalDataSaved: 0,
      userRank: 1,
      userXP: 0,
      userCoins: 0,
      userLevel: 1,
      ownedAvatars: ['avatar_default'],
      equippedAvatar: '👤',
      dailyStreak: 0,
      lastActiveDate: ''
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
    
  } else if (request.action === 'shareExtension') {
    // Award sharing bonus
    chrome.storage.local.get(['userXP', 'userCoins'], (result) => {
      chrome.storage.local.set({
        userXP: (result.userXP || 0) + 300,
        userCoins: (result.userCoins || 0) + 100
      }, () => {
        sendResponse({ success: true, xp: 300, coins: 100 });
      });
    });
    return true;
  }
});

// ============================================
// CLEANUP ON UNLOAD
// ============================================
self.addEventListener('unload', () => {
  if (pendingStorageUpdates.size > 0) {
    flushStorageUpdates();
  }
});

// Initial load
loadFilterList();
chrome.storage.local.get(['blockedUrlsByTab'], (result) => {
  const stored = result.blockedUrlsByTab || {};
  Object.entries(stored).forEach(([tabId, data]) => {
    blockedUrlsByTab.set(parseInt(tabId), data);
  });
});