// WebSocket connection
let ws = null;
let sessionId = null;
let username = null;
let isConnected = false;
let videoElement = null;
let ignoringEvents = false; // Prevent feedback loop
let lastRemoteAction = { type: null, time: null, timestamp: 0 };
let lastEventTime = 0;
const EVENT_THROTTLE_MS = 200; // Minimum time between events
const IGNORE_DURATION = 500; // How long to ignore events after remote action

const WS_URL = 'wss://primewatchparty.onrender.com';

// Initialize WebSocket connection
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Watch Party] Connected to server');
    isConnected = true;
    
    // Join session if we have one
    if (sessionId && username) {
      ws.send(JSON.stringify({ 
        type: 'join', 
        sessionId,
        username,
        url: window.location.href
      }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
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

// Normalize URL for comparison (ignore trailing slash, hash, query params order)
function normalizeURL(urlString) {
  try {
    const url = new URL(urlString);
    // Use pathname without trailing slash + sorted query params
    const path = url.pathname.replace(/\/$/, '');
    return url.origin + path;
  } catch {
    return urlString;
  }
}

// Handle events from remote peers
function handleRemoteEvent(message) {
  if (!videoElement) return;

  const { type, time, url, username: senderUsername } = message;
  
  // Only sync if we're on the same URL (normalized comparison)
  if (url) {
    const theirURL = normalizeURL(url);
    const myURL = normalizeURL(window.location.href);
    
    console.log(`[Watch Party] URL check: ${myURL} vs ${theirURL}`);
    
    if (theirURL !== myURL) {
      console.log(`[Watch Party] ❌ Ignoring event - different URL`);
      return;
    }
  }
  
  console.log(`[Watch Party] ✅ ${senderUsername || 'User'} ${type} at ${time.toFixed(2)}s`);
  
  // Track this remote action
  lastRemoteAction = { type, time, timestamp: Date.now() };
  ignoringEvents = true;

  // Calculate time difference to sync precisely
  const timeDiff = Math.abs(videoElement.currentTime - time);
  
  switch (type) {
    case 'play':
      // Always sync time for play
      if (timeDiff > 0.3) {
        videoElement.currentTime = time;
      }
      videoElement.play().catch(err => console.log('[Watch Party] Play error:', err));
      break;
    case 'pause':
      // Always sync time for pause
      if (timeDiff > 0.3) {
        videoElement.currentTime = time;
      }
      videoElement.pause();
      break;
    case 'seek':
      videoElement.currentTime = time;
      break;
  }

  // Reset flag after video has time to process
  setTimeout(() => {
    ignoringEvents = false;
  }, IGNORE_DURATION);
}

// Send event to server with throttling
function sendEvent(type, time) {
  if (!isConnected || !sessionId || !username) return;

  // Don't send if we're still processing a remote event
  if (ignoringEvents) {
    console.log(`[Watch Party] Ignoring own ${type} event (processing remote)`);
    return;
  }

  // Don't send if this looks like an event we just caused from remote action
  const timeSinceRemote = Date.now() - lastRemoteAction.timestamp;
  if (timeSinceRemote < IGNORE_DURATION) {
    const timeDiff = Math.abs(time - lastRemoteAction.time);
    if (timeDiff < 1.0) {
      console.log(`[Watch Party] Ignoring own ${type} event (matches remote)`);
      return;
    }
  }

  const now = Date.now();
  if (now - lastEventTime < EVENT_THROTTLE_MS && type !== 'pause' && type !== 'play') {
    return; // Throttle rapid events except play/pause
  }
  lastEventTime = now;

  const payload = {
    type,
    time,
    sessionId,
    username,
    url: window.location.href
  };

  ws.send(JSON.stringify(payload));
  console.log(`[Watch Party] Sent ${type} event at ${time.toFixed(2)}s`);
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

  console.log('[Watch Party] Attached to video element');
}

// Find and attach to video element
function findVideo() {
  const video = document.querySelector('video');
  if (video && video !== videoElement) {
    attachVideoListeners(video);
  }
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
  if (request.action === 'start') {
    sessionId = request.sessionId;
    username = request.username;
    
    // Find and attach to video
    findVideo();
    
    if (videoElement) {
      connect();
      sendResponse({ success: true, message: 'Watch party started!' });
    } else {
      sendResponse({ success: false, message: 'No video found on this page' });
    }
  } else if (request.action === 'stop') {
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

