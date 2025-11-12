// WebSocket connection
let ws = null;
let sessionId = null;
let isConnected = false;
let videoElement = null;
let ignoreNextEvent = false; // Prevent feedback loop

const WS_URL = 'wss://primewatchparty.onrender.com';

// Initialize WebSocket connection
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Watch Party] Connected to server');
    isConnected = true;
    
    // Join session if we have one
    if (sessionId) {
      ws.send(JSON.stringify({ type: 'join', sessionId }));
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

  const { type, time } = message;
  
  console.log(`[Watch Party] Received ${type} event at ${time}s`);
  
  // Set flag to ignore our own event handlers
  ignoreNextEvent = true;

  switch (type) {
    case 'play':
      videoElement.currentTime = time;
      videoElement.play();
      break;
    case 'pause':
      videoElement.currentTime = time;
      videoElement.pause();
      break;
    case 'seek':
      videoElement.currentTime = time;
      break;
  }

  // Reset flag after a short delay
  setTimeout(() => {
    ignoreNextEvent = false;
  }, 100);
}

// Send event to server
function sendEvent(type, time) {
  if (!isConnected || !sessionId || ignoreNextEvent) return;

  const payload = {
    type,
    time,
    sessionId
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

// Listen for session changes from popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sessionId) {
    sessionId = changes.sessionId.newValue;
    console.log('[Watch Party] Session ID updated:', sessionId);
    
    if (sessionId && isConnected) {
      ws.send(JSON.stringify({ type: 'join', sessionId }));
    }
  }
});

// Initialize
chrome.storage.local.get(['sessionId'], (result) => {
  sessionId = result.sessionId;
  
  if (sessionId) {
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

