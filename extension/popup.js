const sessionInput = document.getElementById('sessionId');
const joinBtn = document.getElementById('joinBtn');
const generateBtn = document.getElementById('generateBtn');
const status = document.getElementById('status');

// Load current session
chrome.storage.local.get(['sessionId'], (result) => {
  if (result.sessionId) {
    sessionInput.value = result.sessionId;
    updateStatus(result.sessionId);
  }
});

// Generate random session ID
generateBtn.addEventListener('click', () => {
  const randomId = Math.random().toString(36).substring(2, 10);
  sessionInput.value = randomId;
});

// Join session
joinBtn.addEventListener('click', () => {
  const sessionId = sessionInput.value.trim();
  
  if (!sessionId) {
    alert('Please enter a session ID');
    return;
  }
  
  chrome.storage.local.set({ sessionId }, () => {
    updateStatus(sessionId);
  });
});

// Update status display
function updateStatus(sessionId) {
  if (sessionId) {
    status.textContent = `Active: ${sessionId}`;
    status.className = 'status active';
  } else {
    status.textContent = 'Not in a session';
    status.className = 'status inactive';
  }
}

// Allow enter key to join
sessionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

