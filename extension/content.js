// WebSocket connection
let ws = null;
let sessionId = null;
let username = null;
let isConnected = false;
let videoElement = null;
let ignoreNextEvent = false; // Prevent feedback loop
let seekDebounceTimer = null;
let lastEventTime = 0;
const EVENT_THROTTLE_MS = 200; // Minimum time between events

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
    // Auto-reconnect after 3 seconds
    setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Watch Party] WebSocket error:', err);
  };
}

// Handle events from remote peers
function handleRemoteEvent(message) {
  if (!videoElement) return;

  const { type, time, url, username: senderUsername } = message;
  
  // Only sync if we're on the same URL
  if (url && url !== window.location.href) {
    console.log(`[Watch Party] Ignoring event - different URL`);
    return;
  }
  
  console.log(`[Watch Party] ${senderUsername || 'User'} ${type} at ${time}s`);
  
  // Set flag to ignore our own event handlers
  ignoreNextEvent = true;

  // Calculate time difference to sync precisely
  const timeDiff = Math.abs(videoElement.currentTime - time);
  
  switch (type) {
    case 'play':
      if (timeDiff > 0.5) {
        videoElement.currentTime = time;
      }
      videoElement.play().catch(err => console.log('[Watch Party] Play error:', err));
      break;
    case 'pause':
      if (timeDiff > 0.5) {
        videoElement.currentTime = time;
      }
      videoElement.pause();
      break;
    case 'seek':
      videoElement.currentTime = time;
      break;
  }

  // Reset flag after a short delay
  setTimeout(() => {
    ignoreNextEvent = false;
  }, 300);
}

// Send event to server with throttling
function sendEvent(type, time) {
  if (!isConnected || !sessionId || ignoreNextEvent || !username) return;

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
  console.log(`[Watch Party] Sent ${type} event at ${time}s`);
}

// Hook into video element
function attachVideoListeners(video) {
  videoElement = video;

  video.addEventListener('play', () => {
    if (!ignoreNextEvent) {
      sendEvent('play', video.currentTime);
    }
  });

  video.addEventListener('pause', () => {
    if (!ignoreNextEvent) {
      sendEvent('pause', video.currentTime);
    }
  });

  video.addEventListener('seeked', () => {
    if (!ignoreNextEvent) {
      sendEvent('seek', video.currentTime);
    }
  });

  console.log('[Watch Party] Attached to video element');
}

// Find and attach to video element
function findVideo() {
  const video = document.querySelector('video');
  if (video && video !== videoElement) {
    attachVideoListeners(video);
  }
}

// Listen for changes from popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sessionId) {
    sessionId = changes.sessionId.newValue;
    console.log('[Watch Party] Session ID updated:', sessionId);
    
    if (sessionId && username && isConnected) {
      ws.send(JSON.stringify({ 
        type: 'join', 
        sessionId,
        username,
        url: window.location.href
      }));
    }
  }
  
  if (changes.username) {
    username = changes.username.newValue;
    console.log('[Watch Party] Username updated:', username);
  }
});

// Initialize
chrome.storage.local.get(['sessionId', 'username'], (result) => {
  sessionId = result.sessionId;
  username = result.username;
  
  if (sessionId && username) {
    connect();
  }
  
  // Try to find video immediately
  findVideo();
  
  // Keep checking for video element (SPAs might load it later)
  const observer = new MutationObserver(() => {
    if (!videoElement) {
      findVideo();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

