// Achievement/Badge system
const badges = [
  { id: 1, name: 'Getting Started', description: 'Block your first 10 ads', threshold: 10, icon: '🌱', unlocked: false },
  { id: 2, name: 'Ad Defender', description: 'Block 100 ads', threshold: 100, icon: '🛡️', unlocked: false },
  { id: 3, name: 'Privacy Guardian', description: 'Block 500 ads', threshold: 500, icon: '🔒', unlocked: false },
  { id: 4, name: 'Ad Slayer', description: 'Block 1,000 ads', threshold: 1000, icon: '⚔️', unlocked: false },
  { id: 5, name: 'Tracker Hunter', description: 'Block 2,500 ads', threshold: 2500, icon: '🎯', unlocked: false },
  { id: 6, name: 'Master Blocker', description: 'Block 5,000 ads', threshold: 5000, icon: '👑', unlocked: false },
  { id: 7, name: 'Legend', description: 'Block 10,000 ads', threshold: 10000, icon: '🌟', unlocked: false },
  { id: 8, name: 'Grandmaster', description: 'Block 25,000 ads', threshold: 25000, icon: '💎', unlocked: false },
  { id: 9, name: 'Ultimate Guardian', description: 'Block 50,000 ads', threshold: 50000, icon: '🏅', unlocked: false },
  { id: 10, name: 'Ad Annihilator', description: 'Block 100,000 ads', threshold: 100000, icon: '🔥', unlocked: false }
];

let totalBlockedCount = 0;

async function loadAchievements() {
  // Get total blocked from storage
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    totalBlockedCount = result.totalBlockedAllTime || 0;
    updateUI();
  });
}

function updateUI() {
  const totalBlockedEl = document.getElementById('totalBlocked');
  const progressFill = document.getElementById('progressFill');
  const nextBadgeEl = document.getElementById('nextBadge');
  const badgesGrid = document.getElementById('badgesGrid');
  
  // Update total count
  totalBlockedEl.textContent = totalBlockedCount.toLocaleString();
  
  // Determine which badges are unlocked
  badges.forEach(badge => {
    badge.unlocked = totalBlockedCount >= badge.threshold;
  });
  
  // Find next badge to unlock
  const nextBadge = badges.find(b => !b.unlocked);
  if (nextBadge) {
    const progress = (totalBlockedCount / nextBadge.threshold) * 100;
    progressFill.style.width = Math.min(progress, 100) + '%';
    nextBadgeEl.textContent = `Next badge "${nextBadge.name}" at ${nextBadge.threshold.toLocaleString()} blocks`;
  } else {
    progressFill.style.width = '100%';
    nextBadgeEl.textContent = 'All badges unlocked! You are a legend! 🎉';
  }
  
  // Render badges
  badgesGrid.innerHTML = badges.map(badge => `
    <div class="badge-card ${badge.unlocked ? 'unlocked' : 'locked'}">
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${badge.name}</div>
      <div class="badge-description">${badge.description}</div>
      <div class="badge-threshold">${badge.threshold.toLocaleString()} blocks</div>
      ${badge.unlocked ? '<div class="badge-status">✓ Unlocked</div>' : '<div class="badge-status locked-status">🔒 Locked</div>'}
    </div>
  `).join('');
}

// Back button
document.getElementById('goBack').addEventListener('click', () => {
  window.location.href = 'main.html';
});

// Auto-refresh to update progress
setInterval(loadAchievements, 1000);

loadAchievements();