// DOM elements
const setupSection = document.getElementById('setupSection');
const mainSection = document.getElementById('mainSection');
const usernameInput = document.getElementById('username');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const displayUsername = document.getElementById('displayUsername');
const sessionInput = document.getElementById('sessionId');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const generateBtn = document.getElementById('generateBtn');
const status = document.getElementById('status');
const friendUsernameInput = document.getElementById('friendUsername');
const addFriendBtn = document.getElementById('addFriendBtn');
const friendList = document.getElementById('friendList');

let currentUsername = null;
let friends = [];
let isActive = false;

// Initialize - check if user has username
chrome.storage.local.get(['username', 'sessionId', 'friends', 'isActive'], (result) => {
  if (result.username) {
    currentUsername = result.username;
    showMainSection();
  } else {
    showSetupSection();
  }
  
  if (result.sessionId) {
    sessionInput.value = result.sessionId;
  }
  
  if (result.friends) {
    friends = result.friends;
    renderFriendList();
  }
  
  // Restore active state
  if (result.isActive && result.sessionId) {
    isActive = true;
    updateStatus(result.sessionId, true);
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  }
});

// Show setup section
function showSetupSection() {
  setupSection.style.display = 'block';
  mainSection.style.display = 'none';
}

// Show main section
function showMainSection() {
  setupSection.style.display = 'none';
  mainSection.style.display = 'block';
  displayUsername.textContent = currentUsername;
}

// Save username
saveUsernameBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  
  if (!username) {
    alert('Please enter a username');
    return;
  }
  
  if (username.length < 3) {
    alert('Username must be at least 3 characters');
    return;
  }
  
  currentUsername = username;
  chrome.storage.local.set({ username }, () => {
    showMainSection();
  });
});

// Allow enter key for username
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveUsernameBtn.click();
  }
});

// Generate random session ID
generateBtn.addEventListener('click', () => {
  const randomId = Math.random().toString(36).substring(2, 10);
  sessionInput.value = randomId;
});

// Start watch party
startBtn.addEventListener('click', () => {
  const sessionId = sessionInput.value.trim();
  
  if (!sessionId) {
    alert('Please enter a session ID');
    return;
  }
  
  // Save session ID
  chrome.storage.local.set({ sessionId });
  
  // Send message to content script to start
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      alert('No active tab found');
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'start',
      sessionId,
      username: currentUsername
    }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Please refresh the page first!\n\nThe extension needs to load on this page.\n\n1. Refresh the page (F5)\n2. Click Start again');
        return;
      }
      
      if (response && response.success) {
        isActive = true;
        chrome.storage.local.set({ isActive: true });
        updateStatus(sessionId, true);
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else if (response) {
        alert(response.message);
      }
    });
  });
});

// Stop watch party
stopBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'stop'
    }, (response) => {
      isActive = false;
      chrome.storage.local.set({ isActive: false });
      updateStatus(null, false);
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
    });
  });
});

// Allow enter key for session
sessionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    startBtn.click();
  }
});

// Update status display
function updateStatus(sessionId, active) {
  if (active && sessionId) {
    status.innerHTML = `<span>🟢</span><span>Active: ${sessionId}</span>`;
    status.className = 'status active';
  } else {
    status.innerHTML = '<span>⚪</span><span>Not active</span>';
    status.className = 'status inactive';
  }
}

// Add friend
addFriendBtn.addEventListener('click', () => {
  const friendUsername = friendUsernameInput.value.trim();
  
  if (!friendUsername) {
    alert('Please enter a username');
    return;
  }
  
  if (friendUsername === currentUsername) {
    alert("You can't add yourself as a friend!");
    return;
  }
  
  if (friends.includes(friendUsername)) {
    alert('Already friends!');
    return;
  }
  
  friends.push(friendUsername);
  chrome.storage.local.set({ friends }, () => {
    friendUsernameInput.value = '';
    renderFriendList();
  });
});

// Allow enter key for adding friends
friendUsernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addFriendBtn.click();
  }
});

// Render friend list
function renderFriendList() {
  if (friends.length === 0) {
    friendList.innerHTML = '<div class="empty-state">No friends yet. Add some!</div>';
    return;
  }
  
  friendList.innerHTML = friends.map(friend => `
    <div class="friend-item">
      <span class="friend-name">${friend}</span>
      <button class="invite-btn" data-friend="${friend}">Invite</button>
    </div>
  `).join('');
  
  // Add click listeners to invite buttons
  document.querySelectorAll('.invite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const friend = e.target.getAttribute('data-friend');
      inviteFriend(friend);
    });
  });
}

// Invite friend to session
function inviteFriend(friendUsername) {
  chrome.storage.local.get(['sessionId'], (result) => {
    if (!result.sessionId) {
      alert('Please join a session first!');
      return;
    }
    
    // Copy session ID to clipboard
    const inviteText = `Join my watch party! Session ID: ${result.sessionId}`;
    navigator.clipboard.writeText(inviteText).then(() => {
      alert(`Invite copied to clipboard!\nShare with ${friendUsername}`);
    }).catch(() => {
      alert(`Session ID: ${result.sessionId}\n(Copy this manually)`);
    });
  });
}
