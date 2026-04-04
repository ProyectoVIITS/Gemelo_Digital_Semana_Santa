require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { TOLL_SEGMENTS, ALL_STATIONS } = require('../data/nexusCorridorsData');

// ── API Keys ──
const GKEY = process.env.REACT_APP_GOOGLE_ROUTES_KEY || process.env.GOOGLE_ROUTES_KEY || '';
const TOMTOM_KEY = process.env.REACT_APP_TOMTOM_KEY || process.env.TOMTOM_KEY || '';
const HERE_KEY = process.env.REACT_APP_HERE_KEY || process.env.HERE_KEY || '';

// ── Caches por API ──
const googleCache = {};
const tomtomCache = {};
const hereCache = {};
const CACHE_TTL = 120000; // 2 min

let wazeFeedCache = { data: null, ts: 0 };
let wazeTvtCache = { data: null, ts: 0 };
const WAZE_FEED_TTL = 3600000; // 1 hora (60 min) -> Petición estricta del cliente

const globalTrafficStore = {}; 

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchGoogle(stationId) {
  if (!GKEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;
  
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GKEY,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: seg.o.lat, longitude: seg.o.lng } } },
        destination: { location: { latLng: { latitude: seg.d.lat, longitude: seg.d.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;

    const durationSec = parseInt(route.duration?.replace('s', '') || '0', 10);
    const staticSec = parseInt(route.staticDuration?.replace('s', '') || '0', 10);
    const distKm = (route.distanceMeters || seg.dist * 1000) / 1000;
    const currentSpeed = durationSec > 0 ? Math.round(distKm / (durationSec / 3600)) : seg.freeSpeed;
    const freeFlowSpeed = staticSec > 0 ? Math.round(distKm / (staticSec / 3600)) : seg.freeSpeed;
    const congestionRatio = Math.max(0, Math.min(1, 1 - (currentSpeed / Math.max(freeFlowSpeed, 1))));

    const data = { currentSpeed, freeFlowSpeed, congestionRatio, delayMin: Math.round((durationSec - staticSec) / 6) / 10, source: 'google' };
    googleCache[stationId] = { data, ts: Date.now() };
    return data;
  } catch (e) { return null; }
}

async function fetchTomTom(stationId) { return null; /* temporariamente desactivado en origen */ }

function mapHereSeverity(criticality) {
  if (!criticality) return 'info';
  const c = criticality.toLowerCase();
  if (c === 'critical') return 'emergency';
  if (c === 'major') return 'critical';
  if (c === 'minor') return 'warning';
  return 'info';
}

async function fetchHereIncidents(stationId) {
  if (!HERE_KEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg || !seg.tt) return null;

  try {
    const dlat = 0.025, dlng = 0.025;
    const lat = seg.tt.lat, lng = seg.tt.lng;
    const bbox = `${lng - dlng},${lat - dlat},${lng + dlng},${lat + dlat}`;
    const url = `https://data.traffic.hereapi.com/v7/incidents?locationReferencing=shape&in=bbox:${bbox}&apiKey=${HERE_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const incidents = (json.results || []).map(r => ({
      id: r.incidentDetails?.id || Math.random().toString(36).slice(2),
      type: r.incidentDetails?.type || 'UNKNOWN',
      description: r.incidentDetails?.description?.value || 'Incidente',
      severity: mapHereSeverity(r.incidentDetails?.criticality),
      startTime: r.incidentDetails?.startTime,
      endTime: r.incidentDetails?.endTime,
      roadClosed: r.incidentDetails?.roadClosed || false,
      source: 'HERE',
    }));

    const data = { incidents, count: incidents.length, hasRoadClosure: incidents.some(i => i.roadClosed), hasMajorIncident: incidents.some(i => i.severity === 'critical' || i.severity === 'emergency'), source: 'here' };
    hereCache[stationId] = { data, ts: Date.now() };
    return data;
  } catch (e) { return null; }
}

async function fetchWazeFeed() {
  if (wazeFeedCache.data && Date.now() - wazeFeedCache.ts < WAZE_FEED_TTL) return wazeFeedCache.data;
  try {
    const res = await fetch('https://www.waze.com/row-partnerhub-api/partners/11839114302/waze-feeds/d812c9fd-ff24-446f-b7c3-5fee8b7df096?format=1', {
      headers: { 'User-Agent': 'VIITS-NEXUS', 'Accept': 'application/json', 'Referer': 'https://www.waze.com/' }
    });
    if (!res.ok) return wazeFeedCache.data;
    const json = await res.json();
    wazeFeedCache = { data: json.alerts || [], ts: Date.now() };
    return wazeFeedCache.data;
  } catch (e) { return wazeFeedCache.data || []; }
}

async function fetchWazeTvt() {
  if (wazeTvtCache.data && Date.now() - wazeTvtCache.ts < WAZE_FEED_TTL) return wazeTvtCache.data;
  try {
    const res = await fetch('https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648', {
      headers: { 'User-Agent': 'VIITS-NEXUS', 'Accept': 'application/json', 'Referer': 'https://www.waze.com/' }
    });
    if (!res.ok) return wazeTvtCache.data;
    const json = await res.json();
    wazeTvtCache = { data: json.irregularities || json.jams || [], ts: Date.now() };
    return wazeTvtCache.data;
  } catch (e) { return wazeTvtCache.data || []; }
}

function getWazeAlertsForStation(allAlerts, stationId) {
  if (!allAlerts || allAlerts.length === 0) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;
  const nearby = allAlerts.filter(a => a.location && haversine(seg.tt.lat, seg.tt.lng, a.location.y, a.location.x) < 5);
  if (nearby.length === 0) return null;
  return { alertCount: nearby.length, hasAccident: nearby.some(a => (a.type || '').includes('ACCIDENT')), hazards: nearby.map(a => ({ type: a.type, subtype: a.subtype, street: a.street, confidence: a.confidence, lat: a.location?.y, lng: a.location?.x })), maxConfidence: Math.max(...nearby.map(a => a.confidence || 0)), source: 'waze-feed' };
}

function getWazeJamsForStation(allJams, stationId) {
  if (!allJams || allJams.length === 0) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;
  const nearby = allJams.filter(j => {
    if (j.line && j.line.length > 0) return j.line.some(pt => haversine(seg.tt.lat, seg.tt.lng, pt.y, pt.x) < 8);
    if (j.bbox) return haversine(seg.tt.lat, seg.tt.lng, (j.bbox.minY + j.bbox.maxY) / 2, (j.bbox.minX + j.bbox.maxX) / 2) < 8;
    return false;
  });
  if (nearby.length === 0) return null;

  const maxJamLevel = Math.max(...nearby.map(j => j.jamLevel || 0));
  const totalJamLength = nearby.reduce((s, j) => s + (j.length || 0), 0);
  const avgDelay = nearby.reduce((s, j) => s + (j.historicTime > 0 ? (j.time||0)/j.historicTime : 1), 0) / Math.max(nearby.length, 1);
  const wazeCongestion = Math.max(Math.min(1, maxJamLevel / 5), Math.min(1, Math.max(0, (avgDelay - 1) / 2)));
  return { jamCount: nearby.length, maxJamLevel, totalJamLengthM: totalJamLength, totalJamLengthKm: Math.round(totalJamLength / 100) / 10, avgDelayRatio: Math.round(avgDelay * 100) / 100, wazeCongestion, estimatedSpeed: avgDelay > 0 ? Math.round((seg.freeSpeed || 60) / avgDelay) : null, source: 'waze-tvt' };
}

function fuseTrafficData(google, tomtom, here, wazeFeed, wazeTvt) {
  let currentSpeed = null, freeFlowSpeed = null, congestionRatio = null, confidence = 0;
  const speeds = [], freeFlows = [], congestions = [];

  if (google) { speeds.push({val: google.currentSpeed, w: 0.4}); freeFlows.push({val: google.freeFlowSpeed, w: 0.4}); congestions.push({val: google.congestionRatio, w: 0.4}); confidence += 0.4; }
  if (tomtom) { const tc=Math.min(tomtom.confidence||0.5,1); speeds.push({val: tomtom.currentSpeed, w: 0.4*tc}); freeFlows.push({val: tomtom.freeFlowSpeed, w: 0.4*tc}); congestions.push({val: tomtom.congestionRatio, w: 0.4*tc}); confidence += 0.4*tc; }
  if (wazeTvt && wazeTvt.estimatedSpeed != null) { speeds.push({val: wazeTvt.estimatedSpeed, w: 0.2}); congestions.push({val: wazeTvt.wazeCongestion, w: 0.2}); confidence += 0.2; }

  if (speeds.length > 0) {
    const tW = speeds.reduce((s,x)=>s+x.w,0);
    currentSpeed = Math.round(speeds.reduce((s,x)=>s+x.val*x.w,0)/tW);
    freeFlowSpeed = freeFlows.length>0 ? Math.round(freeFlows.reduce((s,x)=>s+x.val*x.w,0)/freeFlows.reduce((s,x)=>s+x.w,0)) : null;
    congestionRatio = Math.min(1, congestions.reduce((s,x)=>s+x.val*x.w,0)/tW);
  }

  const hereIncidents = here?.incidents || [];
  const wazeAlerts = wazeFeed?.hazards?.map(h => ({ id: `waze-${h.type}-${h.lat}`, type: h.subtype || h.type, description: `Waze: ${h.subtype || h.type} en ${h.street || 'vía'}`, severity: h.confidence >= 4 ? 'warning' : 'info', source: 'Waze' })) || [];
  const incidents = [...hereIncidents, ...wazeAlerts];
  const hasRoadClosure = here?.hasRoadClosure || tomtom?.roadClosure || false;

  if (wazeFeed?.hasAccident && congestionRatio !== null) congestionRatio = Math.min(1, congestionRatio + 0.10);
  if (wazeTvt && wazeTvt.maxJamLevel >= 4) congestionRatio = Math.max(congestionRatio || 0, 0.85);
  if (wazeTvt && wazeTvt.maxJamLevel >= 3) congestionRatio = Math.max(congestionRatio || 0, 0.65);
  if (hasRoadClosure) { congestionRatio = Math.max(congestionRatio || 0, 0.95); currentSpeed = Math.min(currentSpeed || 5, 5); }

  const sources = [];
  if (google) sources.push('Google');
  if (tomtom) sources.push('TomTom');
  if (here) sources.push('HERE');
  if (wazeFeed) sources.push('Waze');
  if (wazeTvt) sources.push('WazeTVT');

  return {
    currentSpeed: currentSpeed ?? null, freeFlowSpeed: freeFlowSpeed ?? null, congestionRatio: congestionRatio ?? null, confidence: Math.min(confidence, 1),
    incidents, incidentCount: incidents.length, hasRoadClosure, hasMajorIncident: here?.hasMajorIncident || wazeFeed?.hasAccident || false,
    wazeJamLevel: wazeTvt?.maxJamLevel ?? null, wazeJamLengthKm: wazeTvt?.totalJamLengthKm ?? null, wazeAlertCount: wazeFeed?.alertCount ?? 0,
    delayMin: google?.delayMin || 0, sources, sourceCount: sources.length, timestamp: new Date().toISOString()
  };
}

async function pollOneStation(stationId) {
  const gCache = googleCache[stationId];
  const hCache = hereCache[stationId];
  
  const tomtom = await fetchTomTom(stationId);
  // Escudo Financiero: Se hace fetch a Google maximo cada 1 HORA (3600000) en lugar de 5 min
  const google = (GKEY && (!gCache || Date.now()-gCache.ts>3600000)) ? await fetchGoogle(stationId) : (gCache?.data||null);
  // HERE Map cache: 1 Hora
  const here = (HERE_KEY && (!hCache || Date.now()-hCache.ts>3600000)) ? await fetchHereIncidents(stationId) : (hCache?.data||null);
  
  const allWazeAlerts = await fetchWazeFeed();
  const allWazeJams = await fetchWazeTvt();
  const wFeed = getWazeAlertsForStation(allWazeAlerts, stationId);
  const wTvt = getWazeJamsForStation(allWazeJams, stationId);

  const fused = fuseTrafficData(google, tomtom, here, wFeed, wTvt);
  globalTrafficStore[stationId] = fused;
  return fused;
}

function getTopWazeJams() {
  return (wazeTvtCache.data || [])
    .filter(j => j.jamLevel >= 3 && j.type !== 'STATIC')
    .sort((a, b) => (b.jamLevel - a.jamLevel) || ((b.length || 0) - (a.length || 0)))
    .slice(0, 10);
}

let globalRRIndex = 0;
function startPoller(wss) {
  console.log(`[Backend-Poller] Iniciando polling para ${ALL_STATIONS.length} peajes...`);
  
  // Enviar batch de actualizaciones cada vez que cambia el store
  const broadcast = () => {
    const topWazeJams = getTopWazeJams();

    // NUEVO: Extraer todos los accidentes de Waze activos para el mapa 3D
    const wazeAccidents = (wazeFeedCache.data || [])
      .filter(a => (a.type || '').includes('ACCIDENT'))
      .map(a => ({
        id: a.uuid || Math.random().toString(36).substring(7),
        lat: a.location?.y,
        lng: a.location?.x,
        type: a.subtype || a.type,
        street: a.street,
        confidence: a.confidence,
        reliability: a.reliability,
        ts: a.pubMillis || Date.now()
      }));

    const payload = JSON.stringify({ 
      type: 'traffic_update', 
      data: globalTrafficStore,
      nationalWazeJams: topWazeJams,
      wazeAccidents: wazeAccidents // Inyectado para el Analizador 3D
    });
    wss.clients.forEach(c => {
      if (c.readyState === 1) c.send(payload); 
    });
  };

  setInterval(async () => {
    // Poll 2 stations at a time
    for (let b = 0; b < 2; b++) {
      const sid = ALL_STATIONS[globalRRIndex % ALL_STATIONS.length];
      globalRRIndex++;
      try { await pollOneStation(sid); } catch(e){}
    }
    broadcast();
  }, 4000);

  // Initial Burst
  (async () => {
    for (const sid of ALL_STATIONS) {
      try { await pollOneStation(sid); } catch(e){}
      await new Promise(r=>setTimeout(r,500));
    }
    broadcast();
    console.log('[Backend-Poller] Primera ronda inicializada con éxito.');
  })();

  // ── Snapshot Horario Automatizado (Requerimiento Usuario) ──
  setInterval(() => {
    const now = new Date();
    const accidents = (wazeFeedCache.data || []).filter(a => (a.type || '').includes('ACCIDENT'));
    const snapshotPath = path.resolve(__dirname, '../../public/data/waze_hourly_snapshot.json');
    
    try {
      if (!fs.existsSync(path.dirname(snapshotPath))) fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, JSON.stringify({
        lastUpdate: now.toISOString(),
        count: accidents.length,
        accidents: accidents.map(a => ({ lat: a.location?.y, lng: a.location?.x, type: a.subtype || a.type, ts: a.pubMillis }))
      }));
      console.log(`[Waze-History] Snapshot horario generado: ${accidents.length} accidentes activos.`);
    } catch(e) { console.error('[Waze-History] Error guardando snapshot:', e); }
  }, 3600000); // 1 hora
}

function getStore() { return globalTrafficStore; }
module.exports = { startPoller, getStore, getTopWazeJams };
