// ============================================
// OPTIMIZED LEADERBOARD.JS
// Key Improvements:
// 1. Cached leaderboard generation
// 2. Efficient rendering
// 3. Reduced update frequency
// ============================================

let currentPeriod = 'all';
let userBlockedCount = 0;

// Cache DOM elements
const DOM = {
  yourRank: document.getElementById('yourRank'),
  yourBlocked: document.getElementById('yourBlocked'),
  leaderboardList: document.getElementById('leaderboardList'),
  goBack: document.getElementById('goBack'),
  tabs: document.querySelectorAll('.tab-btn')
};

// Username pool for generation
const USERNAME_PREFIXES = [
  'AdBlocker', 'Privacy', 'NoAds', 'CleanBrowser', 'SafeSurfer',
  'AdNinja', 'TrackSlayer', 'WebGuardian', 'AdFree', 'BlockMaster',
  'AdDestroyer', 'SafeNet', 'NoTrack', 'WebShield'
];

// State tracking
let lastRenderedCount = -1;
let cachedLeaderboard = null;

// ============================================
// OPTIMIZED LEADERBOARD GENERATION
// ============================================
function generateLeaderboardData(userCount) {
  // Return cached if count hasn't changed much
  if (cachedLeaderboard && Math.abs(cachedLeaderboard.userCount - userCount) < 10) {
    return cachedLeaderboard.data;
  }
  
  const leaderboard = [];
  const usedNames = new Set();
  
  // Generate 20 competitors
  for (let i = 0; i < 20; i++) {
    const variance = Math.random() * userCount * 0.3;
    const isHigher = Math.random() > 0.7;
    const count = Math.floor(userCount + (isHigher ? variance : -variance));
    
    // Generate unique username
    let username;
    do {
      const prefix = USERNAME_PREFIXES[Math.floor(Math.random() * USERNAME_PREFIXES.length)];
      const suffix = Math.floor(Math.random() * 1000);
      username = `${prefix}${suffix}`;
    } while (usedNames.has(username));
    
    usedNames.add(username);
    
    leaderboard.push({
      username,
      blocked: Math.max(1, count),
      isUser: false
    });
  }
  
  // Add user
  leaderboard.push({
    username: 'You',
    blocked: userCount,
    isUser: true
  });
  
  // Sort and assign ranks
  leaderboard.sort((a, b) => b.blocked - a.blocked);
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  // Cache result
  cachedLeaderboard = {
    userCount,
    data: leaderboard
  };
  
  return leaderboard;
}

// ============================================
// LOAD LEADERBOARD
// ============================================
function loadLeaderboard() {
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    userBlockedCount = result.totalBlockedAllTime || 0;
    
    // Only regenerate if count changed significantly
    if (Math.abs(userBlockedCount - lastRenderedCount) >= 10 || lastRenderedCount === -1) {
      const leaderboardData = generateLeaderboardData(userBlockedCount);
      updateLeaderboardUI(leaderboardData);
      lastRenderedCount = userBlockedCount;
      
      // Save rank
      const userEntry = leaderboardData.find(e => e.isUser);
      if (userEntry) {
        chrome.storage.local.set({ userRank: userEntry.rank });
      }
    }
  });
}

// ============================================
// EFFICIENT UI UPDATE
// ============================================
function updateLeaderboardUI(leaderboardData) {
  const userEntry = leaderboardData.find(e => e.isUser);
  
  // Update user rank card
  if (userEntry) {
    DOM.yourRank.textContent = `#${userEntry.rank}`;
    DOM.yourBlocked.textContent = userEntry.blocked.toLocaleString();
  }
  
  // Prepare display list
  let displayList = leaderboardData.slice(0, 15);
  
  if (userEntry && userEntry.rank > 15) {
    displayList.push({ separator: true });
    displayList.push(userEntry);
  }
  
  // Render with DocumentFragment
  renderLeaderboard(displayList);
}

// ============================================
// OPTIMIZED RENDERING
// ============================================
const MEDAL_MAP = {
  1: '🥇',
  2: '🥈',
  3: '🥉'
};

function renderLeaderboard(displayList) {
  const fragment = document.createDocumentFragment();
  
  displayList.forEach(entry => {
    if (entry.separator) {
      const separator = document.createElement('div');
      separator.className = 'leaderboard-separator';
      separator.textContent = '...';
      fragment.appendChild(separator);
      return;
    }
    
    const entryDiv = document.createElement('div');
    entryDiv.className = `leaderboard-entry ${entry.isUser ? 'user-entry' : ''}`;
    
    // Rank
    const rankDiv = document.createElement('div');
    rankDiv.className = 'entry-rank';
    rankDiv.textContent = MEDAL_MAP[entry.rank] || `#${entry.rank}`;
    
    // Username
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'entry-username';
    usernameDiv.textContent = entry.username;
    
    // Blocked count
    const blockedDiv = document.createElement('div');
    blockedDiv.className = 'entry-blocked';
    blockedDiv.textContent = entry.blocked.toLocaleString();
    
    entryDiv.appendChild(rankDiv);
    entryDiv.appendChild(usernameDiv);
    entryDiv.appendChild(blockedDiv);
    
    fragment.appendChild(entryDiv);
  });
  
  DOM.leaderboardList.innerHTML = '';
  DOM.leaderboardList.appendChild(fragment);
}

// ============================================
// TAB SWITCHING
// ============================================
DOM.tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    DOM.tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    
    // Invalidate cache to force refresh
    lastRenderedCount = -1;
    loadLeaderboard();
  });
});

// ============================================
// NAVIGATION
// ============================================
DOM.goBack.addEventListener('click', () => {
  window.location.href = 'main.html';
});

// ============================================
// OPTIMIZED AUTO-REFRESH
// ============================================
let refreshInterval;

function startAutoRefresh() {
  // Increased from 5000ms to 10000ms
  refreshInterval = setInterval(loadLeaderboard, 10000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Pause when hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
    loadLeaderboard();
  }
});

// ============================================
// INITIALIZATION
// ============================================
loadLeaderboard();
startAutoRefresh();

window.addEventListener('unload', stopAutoRefresh);