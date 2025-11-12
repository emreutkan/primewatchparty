const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Store sessions: { sessionId: Set<WebSocket> }
const sessions = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  let currentSessionId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const { type, sessionId, time } = message;

      // Handle session join
      if (type === 'join') {
        // Leave previous session if any
        if (currentSessionId && sessions.has(currentSessionId)) {
          sessions.get(currentSessionId).delete(ws);
          if (sessions.get(currentSessionId).size === 0) {
            sessions.delete(currentSessionId);
          }
        }

        // Join new session
        currentSessionId = sessionId;
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, new Set());
        }
        sessions.get(sessionId).add(ws);
        
        console.log(`Client joined session: ${sessionId} (${sessions.get(sessionId).size} total)`);
        return;
      }

      // Relay video control events
      if (['play', 'pause', 'seek'].includes(type) && currentSessionId) {
        const peers = sessions.get(currentSessionId);
        
        if (peers) {
          const payload = JSON.stringify({ type, time, sessionId: currentSessionId });
          
          // Broadcast to everyone in session EXCEPT sender
          peers.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
          
          console.log(`Relayed ${type} event to ${peers.size - 1} peers in session ${currentSessionId}`);
        }
      }

    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    // Clean up on disconnect
    if (currentSessionId && sessions.has(currentSessionId)) {
      sessions.get(currentSessionId).delete(ws);
      if (sessions.get(currentSessionId).size === 0) {
        sessions.delete(currentSessionId);
      }
      console.log(`Client left session: ${currentSessionId}`);
    }
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);

