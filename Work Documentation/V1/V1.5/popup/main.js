// ============================================
// OPTIMIZED MAIN.JS
// Key Improvements:
// 1. Reduced polling frequency
// 2. RequestAnimationFrame for smooth updates
// 3. Debounced updates
// 4. Cached DOM references
// 5. Differential updates (only update changed values)
// ============================================

// Cache DOM references
const DOM = {
  domain: document.getElementById('currentDomain'),
  adCount: document.getElementById('adCount'),
  trackerCount: document.getElementById('trackerCount'),
  totalBlocked: document.getElementById('totalBlocked'),
  rankDisplay: document.getElementById('rankDisplay'),
  btnLearnMore: document.getElementById('btnLearnMore'),
  btnLeaderboard: document.getElementById('btnLeaderboard'),
  achievementsBtn: document.getElementById('achievementsBtn'),
  settingsBtn: document.getElementById('settingsBtn')
};

// Navigation
DOM.btnLearnMore.addEventListener('click', () => window.location.href = 'details.html');
DOM.btnLeaderboard.addEventListener('click', () => window.location.href = 'leaderboard.html');
DOM.achievementsBtn.addEventListener('click', () => window.location.href = 'achievements.html');
DOM.settingsBtn.addEventListener('click', () => window.location.href = 'settings.html');

// State tracking for differential updates
let currentTabId = null;
let lastState = {
  adCount: 0,
  trackerCount: 0,
  totalBlocked: 0,
  rank: 1
};

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) return;

  currentTabId = currentTab.id;

  // Display domain name
  try {
    const urlObj = new URL(currentTab.url);
    DOM.domain.textContent = `<${urlObj.hostname}>`;
  } catch (e) {
    DOM.domain.textContent = '<New Tab>';
  }

  // Start optimized update loop
  startUpdateLoop();
}

// ============================================
// OPTIMIZED UPDATE LOOP WITH RAF
// ============================================
let updateFrameId = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 500; // Update every 500ms (reduced from 200ms)

function startUpdateLoop() {
  function loop(timestamp) {
    // Throttle updates
    if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
      updateStats();
      lastUpdateTime = timestamp;
    }
    
    updateFrameId = requestAnimationFrame(loop);
  }
  
  updateFrameId = requestAnimationFrame(loop);
}

function stopUpdateLoop() {
  if (updateFrameId) {
    cancelAnimationFrame(updateFrameId);
    updateFrameId = null;
  }
}

// ============================================
// DIFFERENTIAL STATE UPDATES
// ============================================
function updateStats() {
  if (currentTabId === null) return;

  // Single message to get all data
  chrome.runtime.sendMessage({ 
    action: 'getBlockedUrlsForTab',
    tabId: currentTabId 
  }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    const blockedUrls = response.blockedUrls || [];

    // Count categories efficiently
    let adCount = 0;
    let trackerCount = 0;

    for (let i = 0; i < blockedUrls.length; i++) {
      if (blockedUrls[i].category === 'Tracker') {
        trackerCount++;
      } else {
        adCount++;
      }
    }

    // Only update DOM if values changed
    if (lastState.adCount !== adCount) {
      DOM.adCount.textContent = adCount;
      lastState.adCount = adCount;
    }

    if (lastState.trackerCount !== trackerCount) {
      DOM.trackerCount.textContent = trackerCount;
      lastState.trackerCount = trackerCount;
    }
  });
  
  // Update total and rank (less frequently)
  updateTotalAndRank();
}

// Cache for total and rank to reduce storage reads
let totalRankCache = null;
let totalRankCacheTime = 0;
const TOTAL_RANK_CACHE_DURATION = 1000; // Cache for 1 second

function updateTotalAndRank() {
  const now = Date.now();
  
  // Use cache if fresh
  if (totalRankCache && (now - totalRankCacheTime) < TOTAL_RANK_CACHE_DURATION) {
    applyTotalAndRank(totalRankCache);
    return;
  }
  
  chrome.storage.local.get(['totalBlockedAllTime', 'userRank'], (result) => {
    if (chrome.runtime.lastError) return;
    
    const data = {
      totalBlocked: result.totalBlockedAllTime || 0,
      rank: result.userRank || 1
    };
    
    totalRankCache = data;
    totalRankCacheTime = now;
    
    applyTotalAndRank(data);
  });
}

function applyTotalAndRank(data) {
  // Only update if changed
  if (lastState.totalBlocked !== data.totalBlocked) {
    DOM.totalBlocked.textContent = data.totalBlocked.toLocaleString();
    lastState.totalBlocked = data.totalBlocked;
  }
  
  if (lastState.rank !== data.rank) {
    DOM.rankDisplay.textContent = `#${data.rank}`;
    lastState.rank = data.rank;
  }
}

// ============================================
// VISIBILITY OPTIMIZATION
// ============================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopUpdateLoop();
  } else {
    startUpdateLoop();
  }
});

// Cleanup on unload
window.addEventListener('unload', () => {
  stopUpdateLoop();
});

// Start everything
init();