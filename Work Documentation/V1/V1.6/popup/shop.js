// Cache DOM elements
const DOM = {
  goBack: document.getElementById('goBack'),
  coinBalance: document.getElementById('coinBalance'),
  shopGrid: document.getElementById('shopGrid'),
  tabs: document.querySelectorAll('.shop-tab')
};

// Shop items catalog
const shopItems = [
  // Free starter items
  { id: 'avatar_default', name: 'Default', icon: '👤', price: 0, category: 'avatars', unlocked: true },
  
  // Tier 1 - 100 coins
  { id: 'avatar_cool', name: 'Cool Guy', icon: '😎', price: 100, category: 'avatars' },
  { id: 'avatar_robot', name: 'Robot', icon: '🤖', price: 100, category: 'avatars' },
  { id: 'avatar_alien', name: 'Alien', icon: '👽', price: 100, category: 'avatars' },
  
  // Tier 2 - 250 coins
  { id: 'avatar_ninja', name: 'Ninja', icon: '🥷', price: 250, category: 'avatars' },
  { id: 'avatar_wizard', name: 'Wizard', icon: '🧙', price: 250, category: 'avatars' },
  { id: 'avatar_pirate', name: 'Pirate', icon: '🏴‍☠️', price: 250, category: 'avatars' },
  
  // Tier 3 - 500 coins
  { id: 'avatar_king', name: 'King', icon: '👑', price: 500, category: 'avatars' },
  { id: 'avatar_dragon', name: 'Dragon', icon: '🐉', price: 500, category: 'avatars' },
  { id: 'avatar_ghost', name: 'Ghost', icon: '👻', price: 500, category: 'avatars' },
  
  // Tier 4 - 1000 coins
  { id: 'avatar_fire', name: 'Fire', icon: '🔥', price: 1000, category: 'avatars' },
  { id: 'avatar_star', name: 'Star', icon: '⭐', price: 1000, category: 'avatars' },
  { id: 'avatar_gem', name: 'Diamond', icon: '💎', price: 1000, category: 'avatars' },
  
  // Tier 5 - 2500 coins (Premium)
  { id: 'avatar_trophy', name: 'Trophy', icon: '🏆', price: 2500, category: 'avatars' },
  { id: 'avatar_rocket', name: 'Rocket', icon: '🚀', price: 2500, category: 'avatars' },
  { id: 'avatar_crown', name: 'Crown', icon: '👸', price: 2500, category: 'avatars' }
];

let currentCategory = 'all';
let userCoins = 0;
let ownedItems = new Set(['avatar_default']);
let equippedItem = 'avatar_default';

function loadShop() {
  chrome.storage.local.get(['userCoins', 'ownedAvatars', 'equippedAvatar'], (result) => {
    userCoins = result.userCoins || 0;
    ownedItems = new Set(result.ownedAvatars || ['avatar_default']);
    
    // Find equipped item
    if (result.equippedAvatar) {
      const equipped = shopItems.find(item => item.icon === result.equippedAvatar);
      equippedItem = equipped ? equipped.id : 'avatar_default';
    } else {
      equippedItem = 'avatar_default';
    }
    
    DOM.coinBalance.textContent = userCoins.toLocaleString();
    renderShop();
  });
}

function renderShop() {
  const filteredItems = currentCategory === 'all' 
    ? shopItems 
    : shopItems.filter(item => item.category === currentCategory);
  
  DOM.shopGrid.innerHTML = '';
  
  filteredItems.forEach(item => {
    const itemDiv = document.createElement('div');
    const isOwned = ownedItems.has(item.id);
    const isEquipped = equippedItem === item.id;
    const canAfford = userCoins >= item.price;
    
    itemDiv.className = 'shop-item';
    if (isOwned) itemDiv.classList.add('owned');
    if (isEquipped) itemDiv.classList.add('equipped');
    
    const iconDiv = document.createElement('div');
    iconDiv.className = 'shop-item-icon';
    iconDiv.textContent = item.icon;
    
    const nameDiv = document.createElement('div');
    nameDiv.textContent = item.name;
    nameDiv.style.fontSize = '11px';
    nameDiv.style.fontWeight = 'bold';
    nameDiv.style.marginBottom = '4px';
    
    itemDiv.appendChild(iconDiv);
    itemDiv.appendChild(nameDiv);
    
    if (isEquipped) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'shop-item-status equipped';
      statusDiv.textContent = '✓ Equipped';
      itemDiv.appendChild(statusDiv);
    } else if (isOwned) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'shop-item-status';
      statusDiv.textContent = 'Owned';
      itemDiv.appendChild(statusDiv);
    } else {
      const priceDiv = document.createElement('div');
      priceDiv.className = 'shop-item-price';
      priceDiv.textContent = `💰 ${item.price}`;
      itemDiv.appendChild(priceDiv);
      
      if (!canAfford) {
        const lockDiv = document.createElement('div');
        lockDiv.className = 'shop-item-locked';
        lockDiv.textContent = '🔒';
        itemDiv.appendChild(lockDiv);
      }
    }
    
    itemDiv.addEventListener('click', () => handleItemClick(item, isOwned, isEquipped, canAfford));
    
    DOM.shopGrid.appendChild(itemDiv);
  });
}

function handleItemClick(item, isOwned, isEquipped, canAfford) {
  if (isEquipped) {
    showNotification('This item is already equipped!');
    return;
  }
  
  if (isOwned) {
    // Equip the item
    equippedItem = item.id;
    chrome.storage.local.set({ equippedAvatar: item.icon }, () => {
      showNotification(`Equipped ${item.name}!`);
      renderShop();
    });
  } else {
    // Try to purchase
    if (!canAfford) {
      showNotification('Not enough coins!');
      return;
    }
    
    if (confirm(`Purchase ${item.name} for ${item.price} coins?`)) {
      userCoins -= item.price;
      ownedItems.add(item.id);
      equippedItem = item.id;
      
      chrome.storage.local.set({
        userCoins: userCoins,
        ownedAvatars: Array.from(ownedItems),
        equippedAvatar: item.icon
      }, () => {
        showNotification(`Purchased and equipped ${item.name}!`);
        loadShop();
      });
    }
  }
}

function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Tab switching
DOM.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCategory = tab.dataset.category;
    renderShop();
  });
});

// Navigation
DOM.goBack.addEventListener('click', () => {
  window.location.href = 'profile.html';
});

// Auto-refresh coins
let refreshInterval;

function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    chrome.storage.local.get(['userCoins'], (result) => {
      const newCoins = result.userCoins || 0;
      if (newCoins !== userCoins) {
        userCoins = newCoins;
        DOM.coinBalance.textContent = userCoins.toLocaleString();
        renderShop();
      }
    });
  }, 2000);
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
    loadShop();
  }
});

// Initialize
loadShop();
startAutoRefresh();

window.addEventListener('unload', stopAutoRefresh);