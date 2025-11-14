// WebSocket connection
let ws = null;
let sessionId = null;
let username = null;
let isConnected = false;
let videoElement = null;
let processingRemoteEvent = false; // Simple flag to prevent immediate echo

const WS_URL = 'wss://primewatchparty.onrender.com';

// Initialize WebSocket connection
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Watch Party] ✅ Connected to server');
    isConnected = true;
    
    // Join session if we have one
    if (sessionId && username) {
      const joinMsg = { 
        type: 'join', 
        sessionId,
        username,
        url: window.location.href
      };
      console.log('[Watch Party] 📤 Joining session:', joinMsg);
      ws.send(JSON.stringify(joinMsg));
    } else {
      console.log('[Watch Party] ⚠️ No session/username to join with');
    }
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('[Watch Party] 📥 Received:', message);
      handleRemoteEvent(message);
    } catch (err) {
      console.error('[Watch Party] Invalid message:', err);
    }
  };

  ws.onclose = () => {
    console.log('[Watch Party] Disconnected from server');
    isConnected = false;
    // Only auto-reconnect if we still have a session and video
    if (sessionId && username && videoElement) {
      setTimeout(connect, 3000);
    }
  };

  ws.onerror = (err) => {
    console.error('[Watch Party] WebSocket error:', err);
  };
}

// Handle events from remote peers
function handleRemoteEvent(message) {
  if (!videoElement) return;

  const { type, time, username: senderUsername } = message;
  
  // Ignore non-video events
  if (type === 'user_joined' || type === 'user_left') {
    console.log(`[Watch Party] 👥 ${senderUsername} ${type === 'user_joined' ? 'joined' : 'left'}`);
    return;
  }
  
  console.log(`[Watch Party] 📥 ${senderUsername} ${type} at ${time.toFixed(2)}s`);
  
  // Set flag to prevent echo
  processingRemoteEvent = true;
  
  switch (type) {
    case 'play':
      videoElement.currentTime = time;
      videoElement.play().catch(err => console.log('[Watch Party] Play error:', err));
      break;
    case 'pause':
      videoElement.currentTime = time;
      videoElement.pause();
      break;
    case 'seek':
      videoElement.currentTime = time;
      break;
  }

  // Reset flag quickly
  setTimeout(() => {
    processingRemoteEvent = false;
  }, 100);
}

// Send event to server
function sendEvent(type, time) {
  // Don't send if we're processing a remote event (prevent immediate echo)
  if (processingRemoteEvent) {
    console.log(`[Watch Party] 🚫 Skipping ${type} (processing remote)`);
    return;
  }

  if (!isConnected || !sessionId || !username) return;

  const payload = {
    type,
    time,
    sessionId,
    username,
    url: window.location.href
  };

  ws.send(JSON.stringify(payload));
  console.log(`[Watch Party] 📤 SENT ${type} at ${time.toFixed(2)}s`);
}

// Hook into video element
function attachVideoListeners(video) {
  videoElement = video;

  // Store handlers so we can remove them later
  video._playHandler = () => {
    sendEvent('play', video.currentTime);
  };
  
  video._pauseHandler = () => {
    sendEvent('pause', video.currentTime);
  };
  
  video._seekHandler = () => {
    sendEvent('seek', video.currentTime);
  };

  video.addEventListener('play', video._playHandler);
  video.addEventListener('pause', video._pauseHandler);
  video.addEventListener('seeked', video._seekHandler);

  console.log('[Watch Party] ✅ Attached to video element:', video);
  console.log('[Watch Party] 📊 Video state: paused=' + video.paused + ', currentTime=' + video.currentTime.toFixed(2));
}

// Find and attach to video element
function findVideo() {
  const video = document.querySelector('video');
  if (!video) {
    console.log('[Watch Party] ❌ No video element found on page');
    return;
  }
  if (video === videoElement) {
    console.log('[Watch Party] ✅ Already attached to video');
    return;
  }
  console.log('[Watch Party] 🔍 Found video element, attaching...');
  attachVideoListeners(video);
}

// Listen for username changes from popup (but don't auto-connect)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.username) {
    username = changes.username.newValue;
    console.log('[Watch Party] Username updated:', username);
  }
});

// Listen for manual start/stop from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Watch Party] 📨 Message from popup:', request);
  
  if (request.action === 'start') {
    sessionId = request.sessionId;
    username = request.username;
    
    console.log(`[Watch Party] 🚀 Starting with session=${sessionId}, username=${username}`);
    
    // Find and attach to video
    findVideo();
    
    if (videoElement) {
      connect();
      sendResponse({ success: true, message: 'Watch party started!' });
    } else {
      sendResponse({ success: false, message: 'No video found on this page' });
    }
  } else if (request.action === 'stop') {
    console.log('[Watch Party] 🛑 Stopping watch party');
    disconnect();
    sendResponse({ success: true, message: 'Watch party stopped' });
  }
  
  return true; // Keep channel open for async response
});

// Disconnect function
function disconnect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  
  // Remove video listeners
  if (videoElement) {
    videoElement.removeEventListener('play', videoElement._playHandler);
    videoElement.removeEventListener('pause', videoElement._pauseHandler);
    videoElement.removeEventListener('seeked', videoElement._seekHandler);
    videoElement = null;
  }
  
  isConnected = false;
  console.log('[Watch Party] Disconnected');
}

// Clean up on tab close
window.addEventListener('beforeunload', () => {
  disconnect();
  chrome.storage.local.set({ isActive: false });
});

// Initialize - just load stored data, don't auto-connect
chrome.storage.local.get(['sessionId', 'username'], (result) => {
  sessionId = result.sessionId;
  username = result.username;
});


