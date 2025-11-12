const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Store sessions: { sessionId: Map<WebSocket, {username, url}> }
const sessions = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  let currentSessionId = null;
  let clientUsername = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const { type, sessionId, time, username, url } = message;

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
        clientUsername = username;
        
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, new Map());
        }
        
        sessions.get(sessionId).set(ws, { username, url });
        
        console.log(`${username} joined session: ${sessionId} (${sessions.get(sessionId).size} total)`);
        
        // Notify other users in the session
        const peers = sessions.get(sessionId);
        peers.forEach((clientInfo, client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'user_joined', 
              username,
              sessionId 
            }));
          }
        });
        
        return;
      }

      // Relay video control events
      if (['play', 'pause', 'seek'].includes(type) && currentSessionId) {
        const peers = sessions.get(currentSessionId);
        
        if (peers) {
          const payload = JSON.stringify({ 
            type, 
            time, 
            sessionId: currentSessionId,
            username: clientUsername,
            url
          });
          
          // Broadcast to everyone in session EXCEPT sender
          let relayedCount = 0;
          peers.forEach((clientInfo, client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
              relayedCount++;
            }
          });
          
          console.log(`${clientUsername} ${type} → ${relayedCount} peers in ${currentSessionId}`);
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
      
      // Notify others that user left
      const peers = sessions.get(currentSessionId);
      peers.forEach((clientInfo, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'user_left', 
            username: clientUsername,
            sessionId: currentSessionId
          }));
        }
      });
      
      if (sessions.get(currentSessionId).size === 0) {
        sessions.delete(currentSessionId);
      }
      console.log(`${clientUsername} left session: ${currentSessionId}`);
    }
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);

