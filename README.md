# Prime Watch Party

Real-time video synchronization using WebSockets. Watch videos together with friends in perfect sync.

## 🚀 Quick Start

### 1. Backend Server
```bash
cd backend
npm install
npm start
```

Server runs on `ws://localhost:8080`

### 2. Chrome Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

### 3. Usage
1. Click the extension icon
2. Generate or enter a session ID
3. Share session ID with friends
4. Navigate to any video site (YouTube, Prime Video, Netflix, etc.)
5. Play/pause/seek syncs automatically

## 🎯 How It Works

**Extension** hooks into `<video>` elements and sends events:
```json
{"type": "pause", "time": 132.52, "sessionId": "abc123"}
```

**Backend** relays events to all peers in the same session (no echo back to sender).

**Zero latency.** Pure WebSockets. No polling garbage.

## 📁 Structure

```
/backend     - Node.js WebSocket server
/extension   - Chrome extension
```
