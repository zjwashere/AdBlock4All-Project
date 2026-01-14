// Cache DOM elements
const DOM = {
  goBack: document.getElementById('goBack'),
  emailInput: document.getElementById('emailInput'),
  shareBtn: document.getElementById('shareBtn'),
  totalShared: document.getElementById('totalShared'),
  coinsEarned: document.getElementById('coinsEarned')
};

// Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Load share statistics
function loadShareStats() {
  chrome.storage.local.get(['totalShared', 'shareCoinsEarned'], (result) => {
    const totalShared = result.totalShared || 0;
    const coinsEarned = result.shareCoinsEarned || 0;
    
    DOM.totalShared.textContent = totalShared;
    DOM.coinsEarned.textContent = coinsEarned.toLocaleString();
  });
}

// Handle share submission
DOM.shareBtn.addEventListener('click', () => {
  const email = DOM.emailInput.value.trim();
  
  if (!email) {
    showNotification('❌ Please enter an email address', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showNotification('❌ Please enter a valid email address', 'error');
    return;
  }
  
  // Disable button during processing
  DOM.shareBtn.disabled = true;
  DOM.shareBtn.textContent = '⏳ Sending...';
  
  // Simulate sending (in a real extension, this would call an API)
  setTimeout(() => {
    // Award rewards
    chrome.runtime.sendMessage({ action: 'shareExtension' }, (response) => {
      if (response && response.success) {
        // Update share statistics
        chrome.storage.local.get(['totalShared', 'shareCoinsEarned'], (result) => {
          const newTotalShared = (result.totalShared || 0) + 1;
          const newCoinsEarned = (result.shareCoinsEarned || 0) + response.coins;
          
          chrome.storage.local.set({
            totalShared: newTotalShared,
            shareCoinsEarned: newCoinsEarned
          }, () => {
            // Show success message
            showNotification(`🎉 Success! Earned ${response.coins} coins & ${response.xp} XP!`, 'success');
            
            // Clear input
            DOM.emailInput.value = '';
            
            // Re-enable button
            DOM.shareBtn.disabled = false;
            DOM.shareBtn.innerHTML = '<span>📧</span> Send Invitation';
            
            // Update stats
            loadShareStats();
          });
        });
      }
    });
  }, 1000);
});

// Back navigation
DOM.goBack.addEventListener('click', () => {
  window.location.href = 'profile.html';
});

// Notification system
let notificationTimeout = null;

function showNotification(message, type = 'success') {
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }
  
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  if (type === 'error') {
    notification.style.background = '#f44336';
  }
  notification.textContent = message;
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// Enter key to submit
DOM.emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    DOM.shareBtn.click();
  }
});

// Initialize
loadShareStats();