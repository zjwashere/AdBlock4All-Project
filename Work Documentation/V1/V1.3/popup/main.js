// Get elements
const domainEl = document.getElementById('currentDomain');
const adCountEl = document.getElementById('adCount');
const trackerCountEl = document.getElementById('trackerCount');
const btnLearnMore = document.getElementById('btnLearnMore');

// Navigate to the list view
btnLearnMore.addEventListener('click', () => {
  window.location.href = 'popup.html';
});

let currentTabId = null;

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

  chrome.runtime.sendMessage({ action: 'getBlockedUrls' }, (response) => {
    // Error handling in case extension context invalidates
    if (chrome.runtime.lastError) return;

    const allBlocked = response.blockedUrls || [];
    
    // Filter items that match the current tab ID
    const pageStats = allBlocked.filter(item => item.tabId === currentTabId);

    let adCount = 0;
    let trackerCount = 0;

    pageStats.forEach(item => {
      if (item.category === 'Tracker') {
        trackerCount++;
      } else {
        adCount++;
      }
    });

    // Update UI
    adCountEl.textContent = adCount;
    trackerCountEl.textContent = trackerCount;
  });
}

// Start everything
init();