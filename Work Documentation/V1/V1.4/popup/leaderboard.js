// Simulated leaderboard data (in a real extension, this would come from a backend)
// For demonstration purposes, we'll generate mock data with the user always near the top
let currentPeriod = 'all';
let userBlockedCount = 0;

// Generate mock leaderboard data
function generateLeaderboardData(userCount) {
  // Create some random competitors
  const names = [
    'AdBlocker Pro', 'PrivacyKing', 'NoAdsPlease', 'CleanBrowser',
    'SafeSurfer', 'AdNinja', 'TrackSlayer', 'WebGuardian',
    'AdFreeLife', 'PrivacyFirst', 'BlockMaster', 'CleanWeb',
    'AdDestroyer', 'SafeNet', 'NoTrack', 'WebShield'
  ];
  
  const leaderboard = [];
  
  // Generate competitors with slightly higher/lower counts
  for (let i = 0; i < 20; i++) {
    const variance = Math.random() * userCount * 0.3; // +/- 30% variance
    const isHigher = Math.random() > 0.7; // 30% chance of higher score
    const count = Math.floor(userCount + (isHigher ? variance : -variance));
    
    leaderboard.push({
      username: names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000),
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
  
  // Sort by blocked count
  leaderboard.sort((a, b) => b.blocked - a.blocked);
  
  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  return leaderboard;
}

function loadLeaderboard() {
  // Get user's total blocked count
  chrome.storage.local.get(['totalBlockedAllTime'], (result) => {
    userBlockedCount = result.totalBlockedAllTime || 0;
    
    const leaderboardData = generateLeaderboardData(userBlockedCount);
    updateLeaderboardUI(leaderboardData);
    
    // Save user's rank to storage so main.js can use it
    const userEntry = leaderboardData.find(e => e.isUser);
    if (userEntry) {
      chrome.storage.local.set({ userRank: userEntry.rank });
    }
  });
}

function updateLeaderboardUI(leaderboardData) {
  const yourRankEl = document.getElementById('yourRank');
  const yourBlockedEl = document.getElementById('yourBlocked');
  const leaderboardList = document.getElementById('leaderboardList');
  
  // Find user's entry
  const userEntry = leaderboardData.find(e => e.isUser);
  
  if (userEntry) {
    yourRankEl.textContent = `#${userEntry.rank}`;
    yourBlockedEl.textContent = userEntry.blocked.toLocaleString();
  }
  
  // Render leaderboard (top 15 + user if not in top 15)
  let displayList = leaderboardData.slice(0, 15);
  
  if (userEntry && userEntry.rank > 15) {
    // Add separator and user's position
    displayList.push({ separator: true });
    displayList.push(userEntry);
  }
  
  leaderboardList.innerHTML = displayList.map(entry => {
    if (entry.separator) {
      return '<div class="leaderboard-separator">...</div>';
    }
    
    const medalEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
    
    return `
      <div class="leaderboard-entry ${entry.isUser ? 'user-entry' : ''}">
        <div class="entry-rank">
          ${medalEmoji || `#${entry.rank}`}
        </div>
        <div class="entry-username">${entry.username}</div>
        <div class="entry-blocked">${entry.blocked.toLocaleString()}</div>
      </div>
    `;
  }).join('');
}

// Tab switching (for demonstration - all show same data)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    loadLeaderboard();
  });
});

// Back button
document.getElementById('goBack').addEventListener('click', () => {
  window.location.href = 'main.html';
});

// Auto-refresh leaderboard and update rank in storage
setInterval(loadLeaderboard, 5000);

loadLeaderboard();