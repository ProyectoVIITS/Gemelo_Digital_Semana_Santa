// backend/websocketServer.js
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { startPoller, getStore } = require('./services/trafficPoller');

function initWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/api/traffic' });
  
  startPoller(wss);

  wss.on('connection', (ws) => {
    console.log('[VIITS WebSocket] 🟢 Nuevo cliente conectado');
    
    // Al conectarse envia el snapshot inicial
    let modeData = {};
    try {
      const calPath = path.join(__dirname, 'config', 'operationCalendar.json');
      modeData = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    } catch(e) { }

    const topWazeJams = (() => {
      try {
        const cache = require('./services/trafficPoller');
        return []; // In initial snapshot, it will be immediately updated by the poller tick.
      } catch(e) { return []; }
    })();

    ws.send(JSON.stringify({ 
      type: 'initial_snapshot', 
      data: getStore(),
      calendar: modeData,
      nationalWazeJams: [] 
    }));

    ws.on('error', console.error);
    ws.on('close', () => {
      console.log('[VIITS WebSocket] 🔴 Cliente desconectado');
    });
  });

  return wss;
}

module.exports = { initWebSocketServer };
