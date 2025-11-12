# Prime Watch Party

Real-time video synchronization using WebSockets. Watch videos together with friends in perfect sync.

## ✨ Features

- **Real-time sync** - Play, pause, and seek events sync instantly
- **URL matching** - Only syncs when you're on the same video
- **Username system** - Set your username and see who's controlling playback
- **Friends list** - Add friends and invite them to sessions
- **Smart throttling** - Fixed rapid click bugs with event throttling
- **Works everywhere** - YouTube, Prime Video, Netflix, any site with HTML5 video

## 🚀 Quick Start

### 1. Backend Server
```bash
cd backend
npm install
npm start
```

Server runs on `ws://localhost:8080`

Or deploy to [Render](https://render.com) for free hosting.

### 2. Chrome Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

### 3. Usage
1. Click the extension icon
2. Set your username (first time only)
3. Generate or enter a session ID
4. Add friends to your list
5. Invite friends by clicking "Invite" next to their name
6. Navigate to the same video as your friends
7. Play/pause/seek syncs automatically!

## 🎯 How It Works

**Extension** hooks into `<video>` elements and sends events with username and URL:
```json
{
  "type": "pause", 
  "time": 132.52, 
  "sessionId": "abc123",
  "username": "emre",
  "url": "https://primevideo.com/..."
}
```

**Backend** relays events to all peers in the same session:
- Only syncs if URLs match
- Shows who triggered each action
- Notifies when users join/leave
- No echo back to sender

**Smart sync**:
- Event throttling prevents rapid click bugs
- Only seeks if time difference > 0.5s
- 300ms ignore window after remote events

## 📁 Structure

```
/backend     - Node.js WebSocket server
/extension   - Chrome extension
```

## 🔧 Configuration

To use a remote server, update `extension/content.js`:
```javascript
const WS_URL = 'wss://your-server.com';
```

Currently configured for: `wss://primewatchparty.onrender.com`
