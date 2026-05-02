// backend/websocketServer.js
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { startPoller, getStore, getTopWazeJams } = require('./services/trafficPoller');

function initWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { URL } = require('url');
    const url = new URL(request.url, 'http://' + request.headers.host);
    if (url.pathname === '/api/traffic') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  startPoller(wss);

  wss.on('connection', (ws) => {
    console.log('[VIITS WebSocket] 🟢 Nuevo cliente conectado');
    
    // Al conectarse envia el snapshot inicial
    let modeData = {};
    try {
      const calPath = path.join(__dirname, 'config', 'operationCalendar.json');
      modeData = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    } catch(e) { }

    const topWazeJams = getTopWazeJams();

    ws.send(JSON.stringify({ 
      type: 'initial_snapshot', 
      data: getStore(),
      calendar: modeData,
      nationalWazeJams: topWazeJams 
    }));

    ws.on('error', console.error);
    ws.on('close', () => {
      console.log('[VIITS WebSocket] 🔴 Cliente desconectado');
    });
  });

  return wss;
}

module.exports = { initWebSocketServer };
