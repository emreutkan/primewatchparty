# Prime Watch Party - Backend

WebSocket relay server for real-time video synchronization.

## Setup

```bash
npm install
npm start
```

Server runs on `ws://localhost:8080`

## Protocol

### Join a session
```json
{
  "type": "join",
  "sessionId": "abc123"
}
```

### Video control events
```json
{
  "type": "play",
  "time": 132.52,
  "sessionId": "abc123"
}
```

```json
{
  "type": "pause",
  "time": 132.52,
  "sessionId": "abc123"
}
```

```json
{
  "type": "seek",
  "time": 200.00,
  "sessionId": "abc123"
}
```

All events are broadcast to peers in the same session (except sender).

