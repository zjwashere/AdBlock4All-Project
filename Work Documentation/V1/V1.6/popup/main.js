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
  settingsBtn: document.getElementById('settingsBtn'),
  profileBtn: document.getElementById('profileBtn'),
  profileIcon: document.getElementById('profileIcon'),
  profileLevel: document.getElementById('profileLevel'),
  profileProgressCircle: document.getElementById('profileProgressCircle'),
  topBadgeIcon: document.getElementById('topBadgeIcon'),
  achievementText: document.getElementById('achievementText'),
  achievementBarFill: document.getElementById('achievementBarFill'),
  powerBtn: document.getElementById('powerBtn'),
  mainContent: document.getElementById('mainContent')
};

// Navigation
DOM.btnLearnMore.addEventListener('click', () => window.location.href = 'details.html');
DOM.btnLeaderboard.addEventListener('click', () => window.location.href = 'leaderboard.html');
DOM.achievementsBtn.addEventListener('click', () => window.location.href = 'achievements.html');
DOM.settingsBtn.addEventListener('click', () => window.location.href = 'settings.html');
DOM.profileBtn.addEventListener('click', () => window.location.href = 'profile.html');

// Badge definitions
const badges = [
  { id: 1, name: 'Getting Started', threshold: 10, icon: '🌱' },
  { id: 2, name: 'Ad Defender', threshold: 100, icon: '🛡️' },
  { id: 3, name: 'Privacy Guardian', threshold: 500, icon: '🔒' },
  { id: 4, name: 'Ad Slayer', threshold: 1000, icon: '⚔️' },
  { id: 5, name: 'Tracker Hunter', threshold: 2500, icon: '🎯' },
  { id: 6, name: 'Master Blocker', threshold: 5000, icon: '👑' },
  { id: 7, name: 'Legend', threshold: 10000, icon: '🌟' },
  { id: 8, name: 'Grandmaster', threshold: 25000, icon: '💎' },
  { id: 9, name: 'Ultimate Guardian', threshold: 50000, icon: '🏅' },
  { id: 10, name: 'Ad Annihilator', threshold: 100000, icon: '🔥' }
];

// XP/Level system
const XP_PER_LEVEL_BASE = 100;
const XP_MULTIPLIER = 1.5;

function calculateXPNeeded(level) {
  return Math.floor(XP_PER_LEVEL_BASE * Math.pow(XP_MULTIPLIER, level - 1));
}

function calculateLevelFromXP(xp) {
  let level = 1;
  let totalXP = 0;
  
  while (totalXP + calculateXPNeeded(level) <= xp) {
    totalXP += calculateXPNeeded(level);
    level++;
  }
  
  return { level, currentLevelXP: xp - totalXP };
}

// State tracking
let currentTabId = null;
let lastState = {
  adCount: 0,
  trackerCount: 0,
  totalBlocked: 0,
  tabBlocked: 0,
  rank: 1,
  topBadge: badges[0],
  nextBadge: badges[1],
  enabled: true
};

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) return;

  currentTabId = currentTab.id;

  try {
    const urlObj = new URL(currentTab.url);
    DOM.domain.textContent = `<${urlObj.hostname}>`;
  } catch (e) {
    DOM.domain.textContent = '<New Tab>';
  }

  loadPowerState();
  startUpdateLoop();
  updateProfileDisplay();
  updateAchievementProgress();
}

let updateFrameId = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 500;

function startUpdateLoop() {
  function loop(timestamp) {
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

function updateStats() {
  if (currentTabId === null) return;

  chrome.runtime.sendMessage({ 
    action: 'getBlockedUrlsForTab',
    tabId: currentTabId 
  }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    const blockedUrls = response.blockedUrls || [];
    const totalCount = response.totalCount || 0;

    let adCount = 0;
    let trackerCount = 0;

    for (let i = 0; i < blockedUrls.length; i++) {
      if (blockedUrls[i].category === 'Tracker') {
        trackerCount++;
      } else {
        adCount++;
      }
    }

    if (lastState.adCount !== adCount) {
      DOM.adCount.textContent = adCount;
      lastState.adCount = adCount;
    }

    if (lastState.trackerCount !== trackerCount) {
      DOM.trackerCount.textContent = trackerCount;
      lastState.trackerCount = trackerCount;
    }

    // Update badge with current tab count
    if (lastState.tabBlocked !== totalCount) {
      lastState.tabBlocked = totalCount;
      updateTabBadge(totalCount);
    }
  });
  
  updateTotalAndRank();
}

function updateTabBadge(count) {
  chrome.storage.local.get(['adBlockerEnabled'], (result) => {
    const enabled = result.adBlockerEnabled !== false;
    
    if (!enabled || count === 0) {
      chrome.action.setBadgeText({ text: '', tabId: currentTabId });
      return;
    }
    
    const badgeText = count >= 1000000 ? (count / 1000000).toFixed(1) + 'M' :
                      count >= 1000 ? (count / 1000).toFixed(1) + 'K' :
                      count.toString();
    chrome.action.setBadgeText({ text: badgeText, tabId: currentTabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336', tabId: currentTabId });
  });
}

let totalRankCache = null;
let totalRankCacheTime = 0;
const TOTAL_RANK_CACHE_DURATION = 1000;

function updateTotalAndRank() {
  const now = Date.now();
  
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
  if (lastState.totalBlocked !== data.totalBlocked) {
    DOM.totalBlocked.textContent = data.totalBlocked.toLocaleString();
    lastState.totalBlocked = data.totalBlocked;
    updateAchievementProgress();
  }
  
  if (lastState.rank !== data.rank) {
    DOM.rankDisplay.textContent = `#${data.rank}`;
    lastState.rank = data.rank;
  }
}

function updateAchievementProgress() {
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    const total = result.totalBlockedAllTime || 0;
    
    // Find highest unlocked badge
    let topBadge = badges[0];
    let prevBadge = badges[0];
    for (const badge of badges) {
      if (total >= badge.threshold) {
        prevBadge = topBadge;
        topBadge = badge;
      } else {
        break;
      }
    }
    
    // Find next badge to unlock
    let nextBadge = null;
    for (const badge of badges) {
      if (total < badge.threshold) {
        nextBadge = badge;
        break;
      }
    }
    
    // Update icon
    DOM.topBadgeIcon.textContent = topBadge.icon;
    
    // Update progress bar and text
    if (nextBadge) {
      const prevThreshold = topBadge.threshold;
      const range = nextBadge.threshold - prevThreshold;
      const current = total - prevThreshold;
      const progress = (current / range) * 100;
      
      DOM.achievementBarFill.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
      DOM.achievementText.textContent = `Next: ${nextBadge.threshold.toLocaleString()}`;
    } else {
      DOM.achievementBarFill.style.width = '100%';
      DOM.achievementText.textContent = 'All unlocked!';
    }
  });
}

function updateProfileDisplay() {
  chrome.storage.local.get(['userXP', 'userLevel', 'equippedAvatar'], (result) => {
    const xp = result.userXP || 0;
    const level = result.userLevel || 1;
    const avatar = result.equippedAvatar || '👤';
    
    DOM.profileLevel.textContent = level;
    DOM.profileIcon.textContent = avatar;
    
    // Calculate XP progress for circle
    const { currentLevelXP } = calculateLevelFromXP(xp);
    const xpNeeded = calculateXPNeeded(level);
    const progress = (currentLevelXP / xpNeeded);
    
    // Circle circumference = 2 * PI * radius = 2 * 3.14159 * 19 ≈ 119.38
    const circumference = 119.38;
    const offset = circumference - (progress * circumference);
    
    DOM.profileProgressCircle.style.strokeDashoffset = offset;
  });
}

// Power button functionality
DOM.powerBtn.addEventListener('click', () => {
  chrome.storage.local.get(['adBlockerEnabled'], (result) => {
    const currentState = result.adBlockerEnabled !== false;
    const newState = !currentState;
    
    chrome.storage.local.set({ adBlockerEnabled: newState }, () => {
      chrome.runtime.sendMessage({ action: 'toggleAdBlocker', enabled: newState });
      updatePowerState(newState);
      
      // Update badge immediately
      if (!newState) {
        chrome.action.setBadgeText({ text: '', tabId: currentTabId });
        chrome.action.setIcon({ 
          path: 'icons/tempIcon_grey.png',
          tabId: currentTabId 
        });
      } else {
        updateTabBadge(lastState.tabBlocked);
        chrome.action.setIcon({ 
          path: 'icons/tempIcon.png',
          tabId: currentTabId 
        });
      }
    });
  });
});

function loadPowerState() {
  chrome.storage.local.get(['adBlockerEnabled'], (result) => {
    const enabled = result.adBlockerEnabled !== false;
    updatePowerState(enabled);
  });
}

function updatePowerState(enabled) {
  lastState.enabled = enabled;
  
  if (enabled) {
    DOM.powerBtn.classList.remove('off');
    DOM.powerBtn.classList.add('on');
    DOM.powerBtn.textContent = '⚡';
    DOM.powerBtn.title = 'Ad Blocker: ON';
    
    // Remove disabled overlay if exists
    const overlay = document.querySelector('.disabled-overlay');
    if (overlay) overlay.remove();
    DOM.mainContent.classList.remove('disabled');
  } else {
    DOM.powerBtn.classList.remove('on');
    DOM.powerBtn.classList.add('off');
    DOM.powerBtn.textContent = '⭕';
    DOM.powerBtn.title = 'Ad Blocker: OFF';
    
    // Add disabled overlay
    const overlay = document.createElement('div');
    overlay.className = 'disabled-overlay';
    overlay.textContent = '🚫 Ad Blocker Disabled';
    document.body.appendChild(overlay);
    DOM.mainContent.classList.add('disabled');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopUpdateLoop();
  } else {
    startUpdateLoop();
    updateProfileDisplay();
    updateAchievementProgress();
    loadPowerState();
  }
});

window.addEventListener('unload', () => {
  stopUpdateLoop();
});

init();