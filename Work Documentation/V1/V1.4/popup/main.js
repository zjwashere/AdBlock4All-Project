// Get elements
const domainEl = document.getElementById('currentDomain');
const adCountEl = document.getElementById('adCount');
const trackerCountEl = document.getElementById('trackerCount');
const totalBlockedEl = document.getElementById('totalBlocked');
const rankDisplayEl = document.getElementById('rankDisplay');
const btnLearnMore = document.getElementById('btnLearnMore');
const btnLeaderboard = document.getElementById('btnLeaderboard');
const achievementsBtn = document.getElementById('achievementsBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Navigation
btnLearnMore.addEventListener('click', () => {
  window.location.href = 'details.html';
});

btnLeaderboard.addEventListener('click', () => {
  window.location.href = 'leaderboard.html';
});

achievementsBtn.addEventListener('click', () => {
  window.location.href = 'achievements.html';
});

settingsBtn.addEventListener('click', () => {
  window.location.href = 'settings.html';
});

let currentTabId = null;
let totalAllTimeCount = 0;

// 1. Initialize: Get the current tab ID once
async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) return;

  currentTabId = currentTab.id;

  // Display domain name
  try {
    const urlObj = new URL(currentTab.url);
    domainEl.textContent = `<${urlObj.hostname}>`;
  } catch (e) {
    domainEl.textContent = '<New Tab>';
  }

  // Start the update loop
  updateStats();
  setInterval(updateStats, 200); // Update every 200ms
}

// 2. The Loop: Fetch data and update UI
function updateStats() {
  if (currentTabId === null) return;

  // Get blocked URLs for current tab only
  chrome.runtime.sendMessage({ 
    action: 'getBlockedUrlsForTab',
    tabId: currentTabId 
  }, (response) => {
    // Error handling in case extension context invalidates
    if (chrome.runtime.lastError) return;

    const blockedUrls = response.blockedUrls || [];

    let adCount = 0;
    let trackerCount = 0;

    // Count from the actual logs
    blockedUrls.forEach(item => {
      if (item.category === 'Tracker') {
        trackerCount++;
      } else {
        adCount++;
      }
    });

    // Update UI with counts
    adCountEl.textContent = adCount;
    trackerCountEl.textContent = trackerCount;
  });
  
  // Update total all-time blocked count and rank
  chrome.storage.local.get(['totalBlockedAllTime', 'userRank'], (result) => {
    if (chrome.runtime.lastError) return;
    
    totalAllTimeCount = result.totalBlockedAllTime || 0;
    totalBlockedEl.textContent = totalAllTimeCount.toLocaleString();
    
    // Get rank from storage (set by leaderboard.js)
    const rank = result.userRank || 1;
    rankDisplayEl.textContent = `#${rank}`;
  });
}

// Start everything
init();