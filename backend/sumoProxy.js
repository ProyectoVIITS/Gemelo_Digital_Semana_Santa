/**
 * sumoProxy.js v2 — Bridge VM SUMO multi-instancia ↔ clientes web (Render)
 *
 * Cambios v2 sobre v1:
 *   - Pool de upstreams (uno por jam_hash demandado por algún cliente web)
 *   - WS /ws/sumo/:hash → upstream lazy (se conecta al primer cliente del hash)
 *   - WS /ws/sumo legacy → upstream eager (siempre conectado, sticky al top)
 *   - Grace period 30s tras desconexión del último cliente de un hash
 *   - Endpoint REST /api/sumo/pool (proxy a /api/pool/status de la VM)
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

const MAX_RECONNECT_DELAY = 30000;
const GRACE_PERIOD_MS = 30000;
const LEGACY_KEY = '__legacy__';
const WS_PATH_RE = /^\/ws\/sumo\/([a-f0-9]{12})$/i;

// upstreams: hash → { ws, connected, clients, lastFrame, frameCount, ... }
const upstreams = new Map();

function getOrCreateUpstream(hash) {
  let u = upstreams.get(hash);
  if (u) return u;
  const wsUrl = hash === LEGACY_KEY
    ? `${SUMO_VM_URL}/ws/sumo`
    : `${SUMO_VM_URL}/ws/sumo/${hash}`;
  u = {
    hash,
    wsUrl,
    ws: null,
    connected: false,
    clients: new Set(),
    lastFrame: null,
    frameCount: 0,
    reconnectDelay: 1000,
    reconnectTimer: null,
    gracePeriodTimer: null,
    shuttingDown: false,
    eager: hash === LEGACY_KEY,
  };
  upstreams.set(hash, u);
  return u;
}

function connectUpstreamFor(u) {
  if (u.shuttingDown) return;
  console.log(`[SUMO-Proxy] Conectando upstream ${u.hash}...`);
  const ws = new WebSocket(u.wsUrl);
  u.ws = ws;

  ws.on('open', () => {
    u.connected = true;
    u.reconnectDelay = 1000;
    console.log(`[SUMO-Proxy] Upstream ${u.hash} conectado`);
  });

  ws.on('message', (data) => {
    u.frameCount++;
    try { u.lastFrame = data.toString(); } catch (_) {}
    if (u.clients.size === 0) return;
    for (const client of u.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(data); } catch (err) {
          console.error(`[SUMO-Proxy] Error enviando a cliente (${u.hash}):`, err.message);
        }
      }
    }
  });

  ws.on('close', (code) => {
    u.connected = false;
    u.ws = null;
    if (u.shuttingDown) return;
    console.warn(`[SUMO-Proxy] Upstream ${u.hash} cerrado (code=${code}). Reintento en ${u.reconnectDelay}ms`);
    u.reconnectTimer = setTimeout(() => {
      u.reconnectTimer = null;
      connectUpstreamFor(u);
    }, u.reconnectDelay);
    u.reconnectDelay = Math.min(u.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error(`[SUMO-Proxy] Error upstream ${u.hash}: ${err.message}`);
  });
}

function teardownUpstream(u) {
  u.shuttingDown = true;
  if (u.reconnectTimer) { clearTimeout(u.reconnectTimer); u.reconnectTimer = null; }
  if (u.gracePeriodTimer) { clearTimeout(u.gracePeriodTimer); u.gracePeriodTimer = null; }
  if (u.ws) {
    try { u.ws.close(); } catch (_) {}
    u.ws = null;
  }
  upstreams.delete(u.hash);
  console.log(`[SUMO-Proxy] Upstream ${u.hash} liberado`);
}

function scheduleGracePeriod(u) {
  if (u.gracePeriodTimer) return;
  if (u.eager) return; // legacy: nunca se libera
  u.gracePeriodTimer = setTimeout(() => {
    u.gracePeriodTimer = null;
    if (u.clients.size === 0) teardownUpstream(u);
  }, GRACE_PERIOD_MS);
}

function attachClient(u, ws) {
  if (u.gracePeriodTimer) {
    clearTimeout(u.gracePeriodTimer);
    u.gracePeriodTimer = null;
  }
  u.clients.add(ws);
  if (!u.ws && !u.shuttingDown) {
    if (u.reconnectTimer) {
      clearTimeout(u.reconnectTimer);
      u.reconnectTimer = null;
    }
    connectUpstreamFor(u);
  }
  if (u.lastFrame) {
    try { ws.send(u.lastFrame); } catch (_) {}
  } else {
    try {
      ws.send(JSON.stringify({
        type: 'sumo_init',
        message: 'Esperando datos de SUMO...',
        upstream_connected: u.connected,
        hash: u.hash === LEGACY_KEY ? null : u.hash,
      }));
    } catch (_) {}
  }
}

function detachClient(u, ws) {
  u.clients.delete(ws);
  if (u.clients.size === 0) {
    scheduleGracePeriod(u);
  }
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

  app.get('/api/sumo/pool', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const result = await proxyHttpGet('/api/pool/status');
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(503).json({ error: 'sumo_unavailable', detail: err.message });
    }
  });

  app.get('/api/sumo/health', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const upstreamsInfo = [];
    let totalClients = 0;
    let totalFrames = 0;
    for (const [hash, u] of upstreams) {
      totalClients += u.clients.size;
      totalFrames += u.frameCount;
      upstreamsInfo.push({
        hash: hash === LEGACY_KEY ? null : hash,
        connected: u.connected,
        clients: u.clients.size,
        frames_received: u.frameCount,
        has_last_frame: u.lastFrame !== null,
        grace_active: u.gracePeriodTimer !== null,
      });
    }
    res.json({
      proxy_status: 'ok',
      upstream_base_url: SUMO_VM_URL,
      upstream_count: upstreams.size,
      total_web_clients: totalClients,
      total_frames_received: totalFrames,
      upstreams: upstreamsInfo,
    });
  });

  console.log('[SUMO-Proxy] Rutas REST registradas (/api/sumo/*)');
}

// ── FASE 2: WebSocket + conexion upstream (DESPUES de app.listen) ─────
function initSumoProxyWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;
    const isLegacy = pathname === '/ws/sumo';
    const hashMatch = pathname.match(WS_PATH_RE);
    if (!isLegacy && !hashMatch) return; // otros handlers manejan otros paths
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;
    let hash;
    if (pathname === '/ws/sumo') {
      hash = LEGACY_KEY;
    } else {
      const m = pathname.match(WS_PATH_RE);
      if (!m) {
        try { ws.close(1003, 'invalid path'); } catch (_) {}
        return;
      }
      hash = m[1].toLowerCase();
    }

    const u = getOrCreateUpstream(hash);
    attachClient(u, ws);
    console.log(`[SUMO-Proxy] Cliente web ${hash} conectado (clientes en hash: ${u.clients.size})`);

    ws.on('message', () => {}); // SOLO LECTURA: ignoramos comandos del cliente

    ws.on('close', () => {
      detachClient(u, ws);
      console.log(`[SUMO-Proxy] Cliente web ${hash} desconectado (restantes: ${u.clients.size})`);
    });

    ws.on('error', () => detachClient(u, ws));
  });

  // Eager-connect del upstream legacy (preserva UX v1: snapshot disponible al primer cliente)
  const legacy = getOrCreateUpstream(LEGACY_KEY);
  connectUpstreamFor(legacy);

  console.log('[SUMO-Proxy] WebSocket /ws/sumo y /ws/sumo/:hash registrados');
  return wss;
}

module.exports = { initSumoProxyRoutes, initSumoProxyWebSocket };
