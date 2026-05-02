/**
 * VIITS NEXUS — Production Static Server
 * Serves the React build folder for 24/7 videowall operation
 *
 * Features:
 * - Serves static build with proper caching
 * - SPA fallback (all routes → index.html)
 * - Health check endpoint (/health)
 * - Memory monitoring
 * - Graceful shutdown
 * - Auto-restart via PM2
 */
const express = require('express');
const path = require('path');
const os = require('os');
const { initWebSocketServer } = require('./backend/websocketServer');
const { initSumoProxy } = require('./backend/sumoProxy');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

// ── Health check endpoint ──
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    uptimeSeconds: Math.floor(uptime),
    memory: {
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
    },
    system: {
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      cpuLoad: os.loadavg()[0]?.toFixed(2) || 'N/A',
    },
    timestamp: new Date().toISOString(),
    timezone: 'America/Bogota',
    colombiaTime: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  });
});

// ── HTTP Fallback para Vercel (Localtunnel/WebSockets bloqueados) ──
app.get('/api/traffic/snapshot', (req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  try {
    const { getStore, getTopWazeJams } = require('./backend/services/trafficPoller');
    let modeData = {};
    try {
      const fs = require('fs');
      const calPath = path.join(__dirname, 'backend', 'config', 'operationCalendar.json');
      modeData = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    } catch(e) {}
    
    res.json({
      type: 'initial_snapshot',
      data: getStore() || {},
      calendar: modeData,
      nationalWazeJams: getTopWazeJams() || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Backend poller not initialized yet' });
  }
});

// ── Inicializar proxy SUMO antes del SPA fallback ──
initSumoProxy(server, app);

// ── Static files with aggressive caching for assets ──
app.use('/static', express.static(path.join(BUILD_DIR, 'static'), {
  maxAge: '1y',
  immutable: true,
}));

// ── Other static files (manifest, icons, etc.) ──
app.use(express.static(BUILD_DIR, {
  maxAge: '1h',
  index: false, // We handle index.html via the SPA fallback
}));

// ── SPA fallback: all routes → index.html (Express v5 syntax) ──
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// ── Start server ──
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VIITS NEXUS] Production server running on port ${PORT}`);
  console.log(`[VIITS NEXUS] Serving build from: ${BUILD_DIR}`);
  console.log(`[VIITS NEXUS] Health check: http://localhost:${PORT}/health`);
  console.log(`[VIITS NEXUS] Colombia time: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
});

// Init WS
initWebSocketServer(server);

// ── Graceful shutdown ──
process.on('SIGTERM', () => {
  console.log('[VIITS NEXUS] SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[VIITS NEXUS] SIGINT received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

// ── Catch uncaught exceptions (PM2 will auto-restart) ──
process.on('uncaughtException', (err) => {
  console.error('[VIITS NEXUS] Uncaught exception:', err);
  process.exit(1); // PM2 will restart
});

process.on('unhandledRejection', (reason) => {
  console.error('[VIITS NEXUS] Unhandled rejection:', reason);
});
