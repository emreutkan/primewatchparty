# Prime Watch Party - Chrome Extension

Real-time video synchronization extension.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder

## Usage

1. Click the extension icon
2. Generate or enter a session ID
3. Click "Join Session"
4. Share the session ID with friends
5. Navigate to any video page (YouTube, Prime Video, Netflix, etc.)
6. Play/pause/seek and it syncs automatically

## How it works

- Detects `<video>` elements on any page
- Hooks into play, pause, and seek events
- Sends events to WebSocket server
- Receives events from peers and applies them locally

Make sure the backend server is running on `ws://localhost:8080`

