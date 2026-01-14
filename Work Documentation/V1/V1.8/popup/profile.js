// Cache DOM elements
const DOM = {
  goBack: document.getElementById('goBack'),
  profileAvatar: document.getElementById('profileAvatar'),
  levelBadge: document.getElementById('levelBadge'),
  currentLevel: document.getElementById('currentLevel'),
  currentXP: document.getElementById('currentXP'),
  currentCoins: document.getElementById('currentCoins'),
  profileBlocked: document.getElementById('profileBlocked'),
  nextLevel: document.getElementById('nextLevel'),
  xpCurrent: document.getElementById('xpCurrent'),
  xpNeeded: document.getElementById('xpNeeded'),
  xpBarFill: document.getElementById('xpBarFill'),
  openShopBtn: document.getElementById('openShopBtn'),
  shareBtn: document.getElementById('shareBtn'),
  viewAchievementsBtn: document.getElementById('viewAchievementsBtn')
};

// XP/Level system configuration
const XP_PER_LEVEL_BASE = 100;
const XP_MULTIPLIER = 1.5;
const XP_PER_AD = 3;
const COINS_PER_AD = 1;

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

function loadProfile() {
  chrome.storage.local.get([
    'totalBlockedAllTime',
    'userXP',
    'userLevel',
    'userCoins',
    'equippedAvatar'
  ], (result) => {
    const totalBlocked = result.totalBlockedAllTime || 0;
    const xp = result.userXP !== undefined ? result.userXP : totalBlocked * XP_PER_AD;
    const coins = result.userCoins !== undefined ? result.userCoins : totalBlocked * COINS_PER_AD;
    const equippedAvatar = result.equippedAvatar || '👤';
    
    // Calculate level from XP
    const { level, currentLevelXP } = calculateLevelFromXP(xp);
    const xpNeeded = calculateXPNeeded(level);
    const xpProgress = (currentLevelXP / xpNeeded) * 100;
    
    // Update display
    DOM.profileAvatar.textContent = equippedAvatar;
    DOM.levelBadge.textContent = `Lv ${level}`;
    DOM.currentLevel.textContent = level;
    DOM.currentXP.textContent = xp.toLocaleString();
    DOM.currentCoins.textContent = coins.toLocaleString();
    DOM.profileBlocked.textContent = totalBlocked.toLocaleString();
    
    DOM.nextLevel.textContent = level + 1;
    DOM.xpCurrent.textContent = currentLevelXP;
    DOM.xpNeeded.textContent = xpNeeded;
    DOM.xpBarFill.style.width = `${xpProgress}%`;
    
    // Save calculated level and initial XP/coins if not set
    if (result.userXP === undefined || result.userCoins === undefined || result.userLevel === undefined) {
      chrome.storage.local.set({
        userXP: xp,
        userCoins: coins,
        userLevel: level
      });
    } else if (result.userLevel !== level) {
      chrome.storage.local.set({ userLevel: level });
    }
  });
}

// Event listeners
DOM.goBack.addEventListener('click', () => {
  window.location.href = 'main.html';
});

DOM.openShopBtn.addEventListener('click', () => {
  window.location.href = 'shop.html';
});

DOM.shareBtn.addEventListener('click', () => {
  window.location.href = 'share.html';
});

DOM.viewAchievementsBtn.addEventListener('click', () => {
  window.location.href = 'achievements.html';
});

// Auto-refresh
let refreshInterval;

function startAutoRefresh() {
  refreshInterval = setInterval(loadProfile, 2000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
    loadProfile();
  }
});

// Initialize
loadProfile();
startAutoRefresh();

window.addEventListener('unload', stopAutoRefresh);