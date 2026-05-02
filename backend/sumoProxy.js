/**
 * sumoProxy.js — Bridge VM SUMO (GCP) ↔ clientes web (Render)
 *
 * Exporta 2 funciones separadas por timing:
 *   - initSumoProxyRoutes(app)       → llamar ANTES del SPA fallback
 *   - initSumoProxyWebSocket(server) → llamar DESPUES de app.listen()
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const SUMO_VM_URL = process.env.SUMO_VM_URL || 'ws://34.73.174.240:8100';
const SUMO_VM_HTTP = SUMO_VM_URL.replace(/^ws/, 'http');

let upstreamWs = null;
let upstreamConnected = false;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
let lastFrame = null;
let frameCount = 0;
const webClients = new Set();

function connectUpstream() {
  const wsUrl = `${SUMO_VM_URL}/ws/sumo`;
  console.log(`[SUMO-Proxy] Conectando a ${wsUrl}...`);
  upstreamWs = new WebSocket(wsUrl);

  upstreamWs.on('open', () => {
    upstreamConnected = true;
    reconnectDelay = 1000;
    console.log(`[SUMO-Proxy] Conectado a ${wsUrl}`);
  });

  upstreamWs.on('message', (data) => {
    frameCount++;
    try { lastFrame = data.toString(); } catch (_) {}
    if (webClients.size === 0) return;
    for (const client of webClients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(data); } catch (err) {
          console.error('[SUMO-Proxy] Error enviando a cliente:', err.message);
        }
      }
    }
  });

  upstreamWs.on('close', (code) => {
    upstreamConnected = false;
    console.warn(`[SUMO-Proxy] Conexion upstream cerrada (code=${code}). Reintentando en ${reconnectDelay}ms`);
    setTimeout(connectUpstream, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  });

  upstreamWs.on('error', (err) => {
    console.error(`[SUMO-Proxy] Error upstream: ${err.message}`);
  });
}

function proxyHttpGet(targetPath) {
  return new Promise((resolve, reject) => {
    const url = `${SUMO_VM_HTTP}${targetPath}`;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── FASE 1: Rutas REST (registrar ANTES del SPA fallback) ─────
function initSumoProxyRoutes(app) {
  app.get('/api/sumo/state', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const result = await proxyHttpGet('/api/state');
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(503).json({ error: 'sumo_unavailable', detail: err.message });
    }
  });

  app.get('/api/sumo/networks', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const result = await proxyHttpGet('/api/networks');
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(503).json({ error: 'sumo_unavailable', detail: err.message });
    }
  });

  app.get('/api/sumo/calibrator', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const result = await proxyHttpGet('/api/calibrator/status');
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(503).json({ error: 'sumo_unavailable', detail: err.message });
    }
  });

  app.get('/api/sumo/health', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      proxy_status: 'ok',
      upstream_url: SUMO_VM_URL,
      upstream_connected: upstreamConnected,
      web_clients: webClients.size,
      frames_received: frameCount,
      has_last_frame: lastFrame !== null,
    });
  });

  console.log('[SUMO-Proxy] Rutas REST registradas (/api/sumo/*)');
}

// ── FASE 2: WebSocket + conexion upstream (DESPUES de app.listen) ─────
function initSumoProxyWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/ws/sumo') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    webClients.add(ws);
    console.log(`[SUMO-Proxy] Cliente web conectado (total: ${webClients.size})`);

    if (lastFrame) {
      try { ws.send(lastFrame); } catch (_) {}
    } else {
      ws.send(JSON.stringify({
        type: 'sumo_init',
        message: 'Esperando datos de SUMO...',
        upstream_connected: upstreamConnected,
      }));
    }

    ws.on('message', () => {}); // SOLO LECTURA: ignoramos comandos del cliente

    ws.on('close', () => {
      webClients.delete(ws);
      console.log(`[SUMO-Proxy] Cliente web desconectado (total: ${webClients.size})`);
    });

    ws.on('error', () => { webClients.delete(ws); });
  });

  connectUpstream();
  console.log('[SUMO-Proxy] WebSocket /ws/sumo registrado y conectando upstream');
  return wss;
}

module.exports = { initSumoProxyRoutes, initSumoProxyWebSocket };
