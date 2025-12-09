// ============================================
// OPTIMIZED ACHIEVEMENTS.JS
// Key Improvements:
// 1. Reduced polling frequency
// 2. Differential rendering
// 3. Cached badge data
// 4. Efficient DOM updates
// ============================================

// Static badge definitions
const badges = [
  { id: 1, name: 'Getting Started', description: 'Block your first 10 ads', threshold: 10, icon: '🌱' },
  { id: 2, name: 'Ad Defender', description: 'Block 100 ads', threshold: 100, icon: '🛡️' },
  { id: 3, name: 'Privacy Guardian', description: 'Block 500 ads', threshold: 500, icon: '🔒' },
  { id: 4, name: 'Ad Slayer', description: 'Block 1,000 ads', threshold: 1000, icon: '⚔️' },
  { id: 5, name: 'Tracker Hunter', description: 'Block 2,500 ads', threshold: 2500, icon: '🎯' },
  { id: 6, name: 'Master Blocker', description: 'Block 5,000 ads', threshold: 5000, icon: '👑' },
  { id: 7, name: 'Legend', description: 'Block 10,000 ads', threshold: 10000, icon: '🌟' },
  { id: 8, name: 'Grandmaster', description: 'Block 25,000 ads', threshold: 25000, icon: '💎' },
  { id: 9, name: 'Ultimate Guardian', description: 'Block 50,000 ads', threshold: 50000, icon: '🏅' },
  { id: 10, name: 'Ad Annihilator', description: 'Block 100,000 ads', threshold: 100000, icon: '🔥' }
];

// Cache DOM elements
const DOM = {
  totalBlocked: document.getElementById('totalBlocked'),
  progressFill: document.getElementById('progressFill'),
  nextBadge: document.getElementById('nextBadge'),
  badgesGrid: document.getElementById('badgesGrid'),
  goBack: document.getElementById('goBack')
};

// State tracking
let totalBlockedCount = 0;
let lastRenderedCount = -1;

// ============================================
// LOAD ACHIEVEMENTS
// ============================================
async function loadAchievements() {
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    totalBlockedCount = result.totalBlockedAllTime || 0;
    
    // Only update if count changed
    if (totalBlockedCount !== lastRenderedCount) {
      updateUI();
      lastRenderedCount = totalBlockedCount;
    }
  });
}

// ============================================
// EFFICIENT UI UPDATE
// ============================================
function updateUI() {
  // Update total count
  DOM.totalBlocked.textContent = totalBlockedCount.toLocaleString();
  
  // Calculate badge status
  const badgeStatus = badges.map(badge => ({
    ...badge,
    unlocked: totalBlockedCount >= badge.threshold
  }));
  
  // Find next badge
  const nextBadge = badgeStatus.find(b => !b.unlocked);
  
  // Update progress bar
  if (nextBadge) {
    const progress = Math.min((totalBlockedCount / nextBadge.threshold) * 100, 100);
    DOM.progressFill.style.width = `${progress}%`;
    DOM.nextBadge.textContent = `Next badge "${nextBadge.name}" at ${nextBadge.threshold.toLocaleString()} blocks`;
  } else {
    DOM.progressFill.style.width = '100%';
    DOM.nextBadge.textContent = 'All badges unlocked! You are a legend! 🎉';
  }
  
  // Render badges efficiently
  renderBadges(badgeStatus);
}

// ============================================
// OPTIMIZED BADGE RENDERING
// ============================================
function renderBadges(badgeStatus) {
  // Use DocumentFragment for efficient DOM manipulation
  const fragment = document.createDocumentFragment();
  
  badgeStatus.forEach(badge => {
    const card = document.createElement('div');
    card.className = `badge-card ${badge.unlocked ? 'unlocked' : 'locked'}`;
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'badge-icon';
    icon.textContent = badge.icon;
    
    // Name
    const name = document.createElement('div');
    name.className = 'badge-name';
    name.textContent = badge.name;
    
    // Description
    const desc = document.createElement('div');
    desc.className = 'badge-description';
    desc.textContent = badge.description;
    
    // Threshold
    const threshold = document.createElement('div');
    threshold.className = 'badge-threshold';
    threshold.textContent = `${badge.threshold.toLocaleString()} blocks`;
    
    // Status
    const status = document.createElement('div');
    status.className = badge.unlocked ? 'badge-status' : 'badge-status locked-status';
    status.textContent = badge.unlocked ? '✓ Unlocked' : '🔒 Locked';
    
    // Assemble
    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(threshold);
    card.appendChild(status);
    
    fragment.appendChild(card);
  });
  
  // Single DOM update
  DOM.badgesGrid.innerHTML = '';
  DOM.badgesGrid.appendChild(fragment);
}

// ============================================
// EVENT HANDLERS
// ============================================
DOM.goBack.addEventListener('click', () => {
  window.location.href = 'main.html';
});

// ============================================
// OPTIMIZED AUTO-REFRESH
// ============================================
let refreshInterval;

function startAutoRefresh() {
  // Reduced from 1000ms to 2000ms
  refreshInterval = setInterval(loadAchievements, 2000);
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
    loadAchievements(); // Immediate update
  }
});

// ============================================
// INITIALIZATION
// ============================================
loadAchievements();
startAutoRefresh();

window.addEventListener('unload', stopAutoRefresh);