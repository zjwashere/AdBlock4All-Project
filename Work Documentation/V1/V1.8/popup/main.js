// ============================================
// OPTIMIZED MAIN.JS WITH REAL-TIME LEVEL UPDATES
// Key Improvements:
// 1. Real-time profile level and XP circle updates
// 2. Fixed time/data rounding issues
// 3. Proper differential rendering
// ============================================

// Cache DOM references
const DOM = {
  domain: document.getElementById('currentDomain'),
  adCount: document.getElementById('adCount'),
  trackerCount: document.getElementById('trackerCount'),
  totalBlocked: document.getElementById('totalBlocked'),
  timeSaved: document.getElementById('timeSaved'),
  dataSaved: document.getElementById('dataSaved'),
  dailyStreak: document.getElementById('dailyStreak'),
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

// Format time saved - Accurate to 2 decimal places
function formatTime(seconds) {
  // Keep 2 decimal precision to avoid floating point errors like x.x0000000002
  seconds = Math.round(seconds * 100) / 100;
  
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = (seconds % 60).toFixed(2);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

// Format data saved - FIXED rounding
function formatData(kb) {
  // Round to avoid floating point issues
  kb = Math.round(kb);
  
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1048576) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1048576).toFixed(2)} GB`;
}

// State tracking - ONLY update DOM when values change
let currentTabId = null;
let lastState = {
  adCount: -1,
  trackerCount: -1,
  totalBlocked: -1,
  timeSaved: -1,
  dataSaved: -1,
  dailyStreak: -1,
  tabBlocked: -1,
  rank: -1,
  enabled: true,
  domain: '',
  profileLevel: -1,
  profileXP: -1,
  profileAvatar: '',
  topBadgeIcon: '',
  achievementProgress: -1
};

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) return;

  currentTabId = currentTab.id;

  try {
    const urlObj = new URL(currentTab.url);
    const domain = `<${urlObj.hostname}>`;
    if (lastState.domain !== domain) {
      DOM.domain.textContent = domain;
      lastState.domain = domain;
    }
  } catch (e) {
    const domain = '<New Tab>';
    if (lastState.domain !== domain) {
      DOM.domain.textContent = domain;
      lastState.domain = domain;
    }
  }

  loadPowerState();
  startUpdateLoop();
  updateProfileDisplay();
  updateAchievementProgress();
}

// ============================================
// OPTIMIZED UPDATE LOOP
// ============================================
let updateFrameId = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 500; // Faster updates for real-time feel

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

// ============================================
// DIFFERENTIAL STATS UPDATE
// ============================================
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

    for (const item of blockedUrls) {
      if (item.category === 'Tracker') {
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

    if (lastState.tabBlocked !== totalCount) {
      lastState.tabBlocked = totalCount;
    }
  });
  
  updateTotalAndRank();
  updateProfileDisplay(); // Update profile on every loop
}

// ============================================
// CACHED TOTAL AND RANK
// ============================================
let totalRankCache = null;
let totalRankCacheTime = 0;
const CACHE_DURATION = 500; // Reduced for faster updates

function updateTotalAndRank() {
  const now = Date.now();
  
  if (totalRankCache && (now - totalRankCacheTime) < CACHE_DURATION) {
    applyTotalAndRank(totalRankCache);
    return;
  }
  
  chrome.storage.local.get([
    'totalBlockedAllTime',
    'totalTimeSaved',
    'totalDataSaved',
    'dailyStreak',
    'userRank'
  ], (result) => {
    if (chrome.runtime.lastError) return;
    
    console.log('Storage values:', result);
    
    const data = {
      totalBlocked: result.totalBlockedAllTime || 0,
      timeSaved: result.totalTimeSaved || 0,
      dataSaved: result.totalDataSaved || 0,
      dailyStreak: result.dailyStreak || 0,
      rank: result.userRank || 1
    };
    
    console.log('Processed data:', data);
    
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
  
  // Always update time/data display - don't cache the formatted string
  const formattedTime = formatTime(data.timeSaved);
  console.log('Formatting time:', data.timeSaved, '→', formattedTime);
  if (DOM.timeSaved.textContent !== formattedTime) {
    DOM.timeSaved.textContent = formattedTime;
    lastState.timeSaved = data.timeSaved;
  }
  
  const formattedData = formatData(data.dataSaved);
  if (DOM.dataSaved.textContent !== formattedData) {
    DOM.dataSaved.textContent = formattedData;
    lastState.dataSaved = data.dataSaved;
  }
  
  if (lastState.dailyStreak !== data.dailyStreak) {
    DOM.dailyStreak.textContent = data.dailyStreak === 1 ? '1 day' : `${data.dailyStreak} days`;
    lastState.dailyStreak = data.dailyStreak;
  }
  
  if (lastState.rank !== data.rank) {
    DOM.rankDisplay.textContent = `#${data.rank}`;
    lastState.rank = data.rank;
  }
}

// ============================================
// ACHIEVEMENT PROGRESS
// ============================================
let achievementCache = null;
let achievementCacheTime = 0;

function updateAchievementProgress() {
  const now = Date.now();
  
  if (achievementCache && (now - achievementCacheTime) < CACHE_DURATION) {
    applyAchievementProgress(achievementCache);
    return;
  }
  
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    const total = result.totalBlockedAllTime || 0;
    
    let topBadge = badges[0];
    for (const badge of badges) {
      if (total >= badge.threshold) {
        topBadge = badge;
      } else {
        break;
      }
    }
    
    let nextBadge = null;
    for (const badge of badges) {
      if (total < badge.threshold) {
        nextBadge = badge;
        break;
      }
    }
    
    const data = {
      topBadge,
      nextBadge,
      total
    };
    
    achievementCache = data;
    achievementCacheTime = now;
    
    applyAchievementProgress(data);
  });
}

function applyAchievementProgress(data) {
  const { topBadge, nextBadge, total } = data;
  
  if (lastState.topBadgeIcon !== topBadge.icon) {
    DOM.topBadgeIcon.textContent = topBadge.icon;
    lastState.topBadgeIcon = topBadge.icon;
  }
  
  if (nextBadge) {
    const prevThreshold = topBadge.threshold;
    const range = nextBadge.threshold - prevThreshold;
    const current = total - prevThreshold;
    const progress = Math.min(Math.max((current / range) * 100, 0), 100);
    
    if (lastState.achievementProgress !== progress) {
      DOM.achievementBarFill.style.width = `${progress}%`;
      lastState.achievementProgress = progress;
    }
    
    const text = `Next: ${nextBadge.threshold.toLocaleString()}`;
    if (DOM.achievementText.textContent !== text) {
      DOM.achievementText.textContent = text;
    }
  } else {
    if (lastState.achievementProgress !== 100) {
      DOM.achievementBarFill.style.width = '100%';
      lastState.achievementProgress = 100;
    }
    
    const text = 'All unlocked!';
    if (DOM.achievementText.textContent !== text) {
      DOM.achievementText.textContent = text;
    }
  }
}

// ============================================
// PROFILE DISPLAY - REAL-TIME UPDATES
// ============================================
let profileCache = null;
let profileCacheTime = 0;

function updateProfileDisplay() {
  const now = Date.now();
  
  // Force update every cycle (no cache for profile)
  chrome.storage.local.get(['userXP', 'userLevel', 'equippedAvatar'], (result) => {
    const xp = result.userXP || 0;
    let level = result.userLevel || 1;
    const avatar = result.equippedAvatar || '👤';
    
    // Recalculate level from XP to ensure accuracy
    const calculated = calculateLevelFromXP(xp);
    if (calculated.level !== level) {
      level = calculated.level;
      chrome.storage.local.set({ userLevel: level });
    }
    
    const data = { xp, level, avatar };
    
    applyProfileDisplay(data);
  });
}

function applyProfileDisplay(data) {
  const { xp, level, avatar } = data;
  
  // Update level badge
  if (lastState.profileLevel !== level) {
    DOM.profileLevel.textContent = level;
    lastState.profileLevel = level;
  }
  
  // Update avatar
  if (lastState.profileAvatar !== avatar) {
    DOM.profileIcon.textContent = avatar;
    lastState.profileAvatar = avatar;
  }
  
  // Update XP circle - recalculate every time for smooth animation
  if (lastState.profileXP !== xp) {
    const { currentLevelXP } = calculateLevelFromXP(xp);
    const xpNeeded = calculateXPNeeded(level);
    const progress = Math.min(currentLevelXP / xpNeeded, 1);
    
    const circumference = 119.38;
    const offset = circumference - (progress * circumference);
    
    DOM.profileProgressCircle.style.strokeDashoffset = offset;
    lastState.profileXP = xp;
  }
}

// ============================================
// POWER BUTTON
// ============================================
DOM.powerBtn.addEventListener('click', () => {
  chrome.storage.local.get(['adBlockerEnabled'], (result) => {
    const currentState = result.adBlockerEnabled !== false;
    const newState = !currentState;
    
    chrome.storage.local.set({ adBlockerEnabled: newState }, () => {
      chrome.runtime.sendMessage({ action: 'toggleAdBlocker', enabled: newState });
      updatePowerState(newState);
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
    
    const overlay = document.querySelector('.disabled-overlay');
    if (overlay) overlay.remove();
    DOM.mainContent.classList.remove('disabled');
  } else {
    DOM.powerBtn.classList.remove('on');
    DOM.powerBtn.classList.add('off');
    DOM.powerBtn.textContent = '⭕';
    DOM.powerBtn.title = 'Ad Blocker: OFF';
    
    if (!document.querySelector('.disabled-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'disabled-overlay';
      overlay.textContent = '🚫 Ad Blocker Disabled';
      document.body.appendChild(overlay);
    }
    DOM.mainContent.classList.add('disabled');
  }
}

// ============================================
// VISIBILITY HANDLING
// ============================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopUpdateLoop();
  } else {
    totalRankCache = null;
    achievementCache = null;
    profileCache = null;
    
    startUpdateLoop();
    updateProfileDisplay();
    updateAchievementProgress();
    loadPowerState();
  }
});

window.addEventListener('unload', stopUpdateLoop);

init();