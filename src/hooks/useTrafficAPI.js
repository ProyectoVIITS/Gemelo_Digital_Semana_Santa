/**
 * useTrafficAPI — 5 APIs de tráfico real → simulación VIITS NEXUS
 *
 * 1. Google Routes API       → velocidad real + congestión (cada 2 min)
 * 2. TomTom Traffic Flow     → velocidad por segmento + confianza (cada 2 min)
 * 3. HERE Traffic             → incidentes reales: accidentes, cierres, obras (cada 10 min)
 * 4. Waze Feed de Datos       → alertas ciudadanas: hazards, accidentes, potholes (cada 3 min)
 * 5. Waze Traffic View (TVT)  → jams reales: jamLevel 0-5, longitud cola, tiempos (cada 3 min)
 *
 * Los datos fusionados alimentan useTollData y TollCanvas directamente.
 * No crea paneles nuevos — solo datos.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── API Keys desde .env ──
const GKEY = process.env.REACT_APP_GOOGLE_ROUTES_KEY || '';
const TOMTOM_KEY = process.env.REACT_APP_TOMTOM_KEY || '';
const HERE_KEY = process.env.REACT_APP_HERE_KEY || '';

// ── Segmentos de vía — 37 peajes INVÍAS (auto-generados desde nexusCorridors) ──
// Origen/destino: ~1km antes y después del peaje para medir velocidad real
// tt: coordenada exacta del peaje para TomTom Flow Segment
const S = (lat, lng, fs) => ({
  o: { lat: +(lat + 0.005).toFixed(4), lng: +(lng - 0.005).toFixed(4) },
  d: { lat: +(lat - 0.005).toFixed(4), lng: +(lng + 0.005).toFixed(4) },
  dist: 1.2, freeSpeed: fs, tt: { lat, lng },
});
const TOLL_SEGMENTS = {
  // C1: Medellín – Honda – Bogotá (8 peajes)
  'C1-01': S(6.345101, -75.526596, 80), // Niquía
  'C1-02': S(6.327898, -75.515533, 80), // Guarne
  'C1-03': S(6.399637, -75.433016, 80), // Trapiche
  'C1-04': S(6.477998, -75.378610, 80), // Pandequeso
  'C1-05': S(6.536330, -75.074777, 80), // Cisneros
  'C1-06': S(6.496650, -74.501381, 80), // Puerto Berrío
  'C1-07': S(5.201507, -74.820282, 80), // Honda
  'C1-08': S(4.780360, -74.185028, 80), // Siberia
  // C2: Popayán – Cali – Cartago (8 peajes)
  'C2-01': S(2.188949, -76.851165, 80), // El Bordo
  'C2-02': S(3.151233, -76.460045, 80), // Villarica
  'C2-03': S(3.557383, -76.462683, 80), // Cencar
  'C2-04': S(3.713096, -76.319180, 80), // Cerrito
  'C2-05': S(3.759986, -76.411322, 80), // Mediacanoa
  'C2-06': S(4.252468, -76.118438, 80), // La Uribe
  'C2-07': S(4.407960, -75.899872, 80), // Corozal
  'C2-08': S(4.793408, -75.859963, 80), // Cerritos II
  // C3: Bogotá – Girardot (4 peajes)
  'C3-01': S(4.537553, -74.272106, 80), // Chusacá
  'C3-02': S(4.269378, -74.500107, 80), // Chinauta
  'C3-03': S(4.403316, -74.731464, 80), // Pubenza
  'C3-04': S(4.192173, -74.861153, 80), // Flandes
  // C4: Ibagué – La Línea – Cajamarca (3 peajes)
  'C4-01': S(4.300429, -75.050087, 80), // Gualanday
  'C4-02': S(4.445527, -75.518799, 60), // Túnel La Línea (Tolima)
  'C4-03': S(4.523458, -75.589381, 60), // Túnel La Línea (Quindío)
  // C5: Bogotá – Villavicencio (4 peajes)
  'C5-01': S(4.285107, -73.834808, 60), // Naranjal
  'C5-02': S(4.201095, -73.721420, 60), // Pipiral
  'C5-03': S(4.026246, -73.775192, 60), // Ocoa
  'C5-04': S(4.056860, -73.463287, 80), // La Libertad
  // C6: Bogotá – Tunja (4 peajes)
  'C6-01': S(4.822679, -74.033081, 80), // Andes
  'C6-02': S(5.031299, -73.839882, 80), // El Roble
  'C6-03': S(5.290461, -73.583504, 80), // Albarracín
  'C6-04': S(5.656897, -73.278435, 80), // Tuta
  // C7: Santa Marta – Barranquilla (6 peajes)
  'C7-01': S(11.253129, -74.109322, 80), // Neguanje
  'C7-02': S(10.608947, -74.168495, 80), // Tucunica
  'C7-03': S(10.977188, -74.336664, 80), // Tasajera
  'C7-04': S(10.978719, -74.729719, 80), // Laureano Gómez
  'C7-05': S(10.799582, -74.759003, 80), // Sabanagrande
  'C7-06': S(10.837545, -74.902122, 80), // Galapa
  // Autopistas del Café — 7 peajes (Fiscalización MinTransporte)
  'ADC-01': S(5.0483, -75.4855, 60),  // Pavas (Manizales)
  'ADC-02': S(5.0355, -75.5121, 60),  // San Bernardo (Manizales)
  'ADC-03': S(5.0713, -75.5977, 80),  // Santágueda (Palestina)
  'ADC-04': S(4.9846, -75.6328, 80),  // Tarapacá I (Chinchiná)
  'ADC-05': S(4.8923, -75.6261, 80),  // Tarapacá II (Santa Rosa)
  'ADC-06': S(4.6189, -75.6371, 80),  // Circasia (Filandia/Circasia)
  'ADC-07': S(4.4080, -75.8999, 80),  // Corozal (La Victoria)
};

// ── Caches por API ──
const googleCache = {};
const tomtomCache = {};
const hereCache = {};
const CACHE_TTL = 120000; // 2 min

// ═══════════════════════════════════════════════════════
// 1. GOOGLE ROUTES API — Velocidad real + congestión
// ═══════════════════════════════════════════════════════
async function fetchGoogle(stationId) {
  if (!GKEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;
  if (googleCache[stationId] && Date.now() - googleCache[stationId].ts < CACHE_TTL) return googleCache[stationId].data;

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
    console.log(`[VIITS] 🟢 Google ${stationId}: ${currentSpeed} km/h | congestión ${Math.round(congestionRatio * 100)}%`);
    return data;
  } catch (e) {
    console.warn('[VIITS] Google error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// 2. TOMTOM TRAFFIC FLOW — Velocidad por segmento
// ═══════════════════════════════════════════════════════
async function fetchTomTom(stationId) {
  // TomTom desactivado temporalmente — free tier excedido (2,500 req/día)
  // Google + Waze + HERE cubren la funcionalidad
  return null;
  if (!TOMTOM_KEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg || !seg.tt) return null;
  if (tomtomCache[stationId] && Date.now() - tomtomCache[stationId].ts < CACHE_TTL) return tomtomCache[stationId].data;

  try {
    // Flow Segment Data: velocidad actual vs flujo libre para el segmento de vía
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${seg.tt.lat},${seg.tt.lng}&key=${TOMTOM_KEY}&unit=KMPH`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const flow = json.flowSegmentData;
    if (!flow) return null;

    const data = {
      currentSpeed: Math.round(flow.currentSpeed || 0),
      freeFlowSpeed: Math.round(flow.freeFlowSpeed || seg.freeSpeed),
      currentTravelTime: flow.currentTravelTime || 0,
      freeFlowTravelTime: flow.freeFlowTravelTime || 0,
      confidence: flow.confidence || 0,
      roadClosure: flow.roadClosure || false,
      congestionRatio: Math.max(0, Math.min(1, 1 - ((flow.currentSpeed || 0) / Math.max(flow.freeFlowSpeed || 1, 1)))),
      source: 'tomtom',
    };

    tomtomCache[stationId] = { data, ts: Date.now() };
    console.log(`[VIITS] 🔵 TomTom ${stationId}: ${data.currentSpeed} km/h | libre ${data.freeFlowSpeed} km/h | confianza ${data.confidence} | ${data.roadClosure ? '🚫 VÍA CERRADA' : 'abierta'}`);
    return data;
  } catch (e) {
    console.warn('[VIITS] TomTom error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// 3. HERE TRAFFIC — Incidentes reales
// ═══════════════════════════════════════════════════════
async function fetchHereIncidents(stationId) {
  if (!HERE_KEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg || !seg.tt) return null;
  if (hereCache[stationId] && Date.now() - hereCache[stationId].ts < CACHE_TTL) return hereCache[stationId].data;

  try {
    // Bounding box ~5km alrededor del peaje
    const dlat = 0.025, dlng = 0.025;
    const lat = seg.tt.lat, lng = seg.tt.lng;
    const bbox = `${lng - dlng},${lat - dlat},${lng + dlng},${lat + dlat}`;

    const url = `https://data.traffic.hereapi.com/v7/incidents?locationReferencing=shape&in=bbox:${bbox}&apiKey=${HERE_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const results = json.results || [];

    const incidents = results.map(r => ({
      id: r.incidentDetails?.id || Math.random().toString(36).slice(2),
      type: r.incidentDetails?.type || 'UNKNOWN',
      description: r.incidentDetails?.description?.value || 'Incidente reportado',
      severity: mapHereSeverity(r.incidentDetails?.criticality),
      startTime: r.incidentDetails?.startTime,
      endTime: r.incidentDetails?.endTime,
      roadClosed: r.incidentDetails?.roadClosed || false,
      source: 'HERE',
    }));

    const data = {
      incidents,
      count: incidents.length,
      hasRoadClosure: incidents.some(i => i.roadClosed),
      hasMajorIncident: incidents.some(i => i.severity === 'critical' || i.severity === 'emergency'),
      source: 'here',
    };

    hereCache[stationId] = { data, ts: Date.now() };
    if (incidents.length > 0) {
      console.log(`[VIITS] 🔴 HERE ${stationId}: ${incidents.length} incidente(s) —`, incidents.map(i => `${i.type}: ${i.description}`).join(' | '));
    } else {
      console.log(`[VIITS] 🟡 HERE ${stationId}: sin incidentes reportados`);
    }
    return data;
  } catch (e) {
    console.warn('[VIITS] HERE error:', e.message);
    return null;
  }
}

function mapHereSeverity(criticality) {
  if (!criticality) return 'info';
  const c = criticality.toLowerCase();
  if (c === 'critical') return 'emergency';
  if (c === 'major') return 'critical';
  if (c === 'minor') return 'warning';
  return 'info';
}

// ═══════════════════════════════════════════════════════
// 4. WAZE FEED — Alertas ciudadanas (hazards, accidentes)
// ═══════════════════════════════════════════════════════
// Waze URLs: usar proxy serverless en producción (CORS bloqueado), directo en dev
const IS_PROD = window.location.hostname !== 'localhost';
const WAZE_FEED_URL = IS_PROD
  ? '/api/waze-feed'
  : 'https://www.waze.com/row-partnerhub-api/partners/11839114302/waze-feeds/d812c9fd-ff24-446f-b7c3-5fee8b7df096?format=1';
const WAZE_TVT_URL = IS_PROD
  ? '/api/waze-tvt'
  : 'https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648';
const WAZE_FEED_TTL = 180000; // 3 min
let wazeFeedCache = { data: null, ts: 0 };
let wazeTvtCache = { data: null, ts: 0 };

// Haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWazeFeed() {
  if (wazeFeedCache.data && Date.now() - wazeFeedCache.ts < WAZE_FEED_TTL) return wazeFeedCache.data;
  try {
    const res = await fetch(WAZE_FEED_URL);
    if (!res.ok) return wazeFeedCache.data;
    const json = await res.json();
    const alerts = json.alerts || [];
    wazeFeedCache = { data: alerts, ts: Date.now() };
    console.log(`[VIITS] 🟠 Waze Feed: ${alerts.length} alertas Colombia`);
    return alerts;
  } catch (e) {
    console.warn('[VIITS] Waze Feed error:', e.message);
    return wazeFeedCache.data || [];
  }
}

function getWazeAlertsForStation(allAlerts, stationId) {
  if (!allAlerts || allAlerts.length === 0) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;

  const RADIUS_KM = 5;
  const nearby = allAlerts.filter(a =>
    a.location && haversine(seg.tt.lat, seg.tt.lng, a.location.y, a.location.x) < RADIUS_KM
  );

  if (nearby.length === 0) return null;
  return {
    alertCount: nearby.length,
    hasAccident: nearby.some(a => (a.type || '').includes('ACCIDENT')),
    hazards: nearby.map(a => ({
      type: a.type, subtype: a.subtype, street: a.street,
      confidence: a.confidence, lat: a.location?.y, lng: a.location?.x,
    })),
    maxConfidence: Math.max(...nearby.map(a => a.confidence || 0)),
    source: 'waze-feed',
  };
}

// ═══════════════════════════════════════════════════════
// 5. WAZE TRAFFIC VIEW — Jams reales con nivel y longitud
// ═══════════════════════════════════════════════════════
async function fetchWazeTvt() {
  if (wazeTvtCache.data && Date.now() - wazeTvtCache.ts < WAZE_FEED_TTL) return wazeTvtCache.data;
  try {
    const res = await fetch(WAZE_TVT_URL);
    if (!res.ok) return wazeTvtCache.data;
    const json = await res.json();
    // TVT returns irregularities array with jams
    const jams = json.irregularities || json.jams || [];
    wazeTvtCache = { data: jams, ts: Date.now() };
    const totalLength = jams.reduce((s, j) => s + (j.length || 0), 0);
    console.log(`[VIITS] 🟣 Waze TVT: ${jams.length} tramos congestión | ${Math.round(totalLength / 1000)} km total`);
    return jams;
  } catch (e) {
    console.warn('[VIITS] Waze TVT error:', e.message);
    return wazeTvtCache.data || [];
  }
}

function getWazeJamsForStation(allJams, stationId) {
  if (!allJams || allJams.length === 0) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;

  const RADIUS_KM = 8;
  const nearby = allJams.filter(j => {
    // Check bbox or line coordinates
    if (j.line && j.line.length > 0) {
      return j.line.some(pt => haversine(seg.tt.lat, seg.tt.lng, pt.y, pt.x) < RADIUS_KM);
    }
    if (j.bbox) {
      const cLat = (j.bbox.minY + j.bbox.maxY) / 2;
      const cLng = (j.bbox.minX + j.bbox.maxX) / 2;
      return haversine(seg.tt.lat, seg.tt.lng, cLat, cLng) < RADIUS_KM;
    }
    return false;
  });

  if (nearby.length === 0) return null;

  const maxJamLevel = Math.max(...nearby.map(j => j.jamLevel || 0));
  const totalJamLength = nearby.reduce((s, j) => s + (j.length || 0), 0);
  const avgDelay = nearby.reduce((s, j) => {
    const realTime = j.time || 0;
    const historicTime = j.historicTime || realTime;
    return s + (historicTime > 0 ? realTime / historicTime : 1);
  }, 0) / Math.max(nearby.length, 1);

  // jamLevel 0-5 → congestionRatio 0-1
  const jamCongestion = Math.min(1, maxJamLevel / 5);
  // avgDelay ratio: 1 = normal, 2 = double time, 3+ = severe
  const delayCongestion = Math.min(1, Math.max(0, (avgDelay - 1) / 2));
  // Combined Waze congestion: higher of jam level and delay ratio
  const wazeCongestion = Math.max(jamCongestion, delayCongestion);

  return {
    jamCount: nearby.length,
    maxJamLevel,
    totalJamLengthM: totalJamLength,
    totalJamLengthKm: Math.round(totalJamLength / 100) / 10,
    avgDelayRatio: Math.round(avgDelay * 100) / 100,
    wazeCongestion,
    // Estimate speed from delay ratio (freeSpeed / delayRatio)
    estimatedSpeed: avgDelay > 0 ? Math.round((seg.freeSpeed || 60) / avgDelay) : null,
    source: 'waze-tvt',
  };
}

// ═══════════════════════════════════════════════════════
// FUSIÓN — Combina las 5 APIs en un solo estado
// ═══════════════════════════════════════════════════════
function fuseTrafficData(google, tomtom, here, wazeFeed, wazeTvt) {
  // Velocidad: promedio ponderado Google (40%) + TomTom (40%) + Waze TVT (20%)
  let currentSpeed = null;
  let freeFlowSpeed = null;
  let congestionRatio = null;
  let confidence = 0;

  const speeds = [];
  const freeFlows = [];
  const congestions = [];

  if (google) {
    speeds.push({ val: google.currentSpeed, w: 0.4 });
    freeFlows.push({ val: google.freeFlowSpeed, w: 0.4 });
    congestions.push({ val: google.congestionRatio, w: 0.4 });
    confidence += 0.4;
  }
  if (tomtom) {
    const ttConf = Math.min(tomtom.confidence || 0.5, 1);
    speeds.push({ val: tomtom.currentSpeed, w: 0.4 * ttConf });
    freeFlows.push({ val: tomtom.freeFlowSpeed, w: 0.4 * ttConf });
    congestions.push({ val: tomtom.congestionRatio, w: 0.4 * ttConf });
    confidence += 0.4 * ttConf;
  }
  if (wazeTvt && wazeTvt.estimatedSpeed != null) {
    speeds.push({ val: wazeTvt.estimatedSpeed, w: 0.2 });
    congestions.push({ val: wazeTvt.wazeCongestion, w: 0.2 });
    confidence += 0.2;
  }

  if (speeds.length > 0) {
    const totalW = speeds.reduce((s, x) => s + x.w, 0);
    currentSpeed = Math.round(speeds.reduce((s, x) => s + x.val * x.w, 0) / totalW);
    freeFlowSpeed = freeFlows.length > 0 ? Math.round(freeFlows.reduce((s, x) => s + x.val * x.w, 0) / freeFlows.reduce((s, x) => s + x.w, 0)) : null;
    congestionRatio = Math.min(1, congestions.reduce((s, x) => s + x.val * x.w, 0) / totalW);
  }

  // Incidentes: fusión HERE + Waze Feed
  const hereIncidents = here?.incidents || [];
  const wazeAlerts = wazeFeed?.hazards?.map(h => ({
    id: `waze-${h.type}-${h.lat}`,
    type: h.subtype || h.type,
    description: `Waze: ${h.subtype || h.type} en ${h.street || 'vía'}`,
    severity: h.confidence >= 4 ? 'warning' : 'info',
    source: 'Waze',
  })) || [];
  const incidents = [...hereIncidents, ...wazeAlerts];

  const hasRoadClosure = here?.hasRoadClosure || tomtom?.roadClosure || false;

  // Waze accidente → boost congestión +10%
  if (wazeFeed?.hasAccident && congestionRatio !== null) {
    congestionRatio = Math.min(1, congestionRatio + 0.10);
  }

  // Waze TVT jam level ≥4 → boost congestión
  if (wazeTvt && wazeTvt.maxJamLevel >= 4 && congestionRatio !== null) {
    congestionRatio = Math.max(congestionRatio, 0.85);
  }

  // Si hay cierre de vía, congestión al 100%
  if (hasRoadClosure && congestionRatio !== null) {
    congestionRatio = Math.max(congestionRatio, 0.95);
    currentSpeed = Math.min(currentSpeed || 5, 5);
  }

  // Sources activas
  const sources = [];
  if (google) sources.push('Google');
  if (tomtom) sources.push('TomTom');
  if (here) sources.push('HERE');
  if (wazeFeed) sources.push('Waze');
  if (wazeTvt) sources.push('WazeTVT');

  return {
    currentSpeed: currentSpeed ?? null,
    freeFlowSpeed: freeFlowSpeed ?? null,
    congestionRatio: congestionRatio ?? null,
    confidence: Math.min(confidence, 1),

    incidents,
    incidentCount: incidents.length,
    hasRoadClosure,
    hasMajorIncident: here?.hasMajorIncident || wazeFeed?.hasAccident || false,

    // Waze-specific
    wazeJamLevel: wazeTvt?.maxJamLevel ?? null,
    wazeJamLengthKm: wazeTvt?.totalJamLengthKm ?? null,
    wazeAlertCount: wazeFeed?.alertCount ?? 0,

    delayMin: google?.delayMin || 0,

    sources,
    sourceCount: sources.length,
    timestamp: new Date().toISOString(),

    _google: google,
    _tomtom: tomtom,
    _here: here,
    _wazeFeed: wazeFeed,
    _wazeTvt: wazeTvt,
  };
}

// ═══════════════════════════════════════════════════════
// HOOK PRINCIPAL — Polling cada 2 min, 3 APIs en paralelo
// ═══════════════════════════════════════════════════════
export function useTrafficAPI(stationId, intervalMs = 120000) {
  const [traffic, setTraffic] = useState(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (!mountedRef.current || !stationId) return;
    if (!GKEY && !TOMTOM_KEY && !HERE_KEY) return;

    // Lanzar 5 APIs en PARALELO (Waze son globales, filtradas por estación)
    const [google, tomtom, here, allWazeAlerts, allWazeJams] = await Promise.all([
      fetchGoogle(stationId),
      fetchTomTom(stationId),
      fetchHereIncidents(stationId),
      fetchWazeFeed(),
      fetchWazeTvt(),
    ]);

    if (!mountedRef.current) return;

    const wazeFeed = getWazeAlertsForStation(allWazeAlerts, stationId);
    const wazeTvt = getWazeJamsForStation(allWazeJams, stationId);
    const fused = fuseTrafficData(google, tomtom, here, wazeFeed, wazeTvt);
    setTraffic(fused);

    console.log(
      `[VIITS Traffic] ✅ ${stationId}: ${fused.currentSpeed ?? '?'} km/h real | ${fused.freeFlowSpeed ?? '?'} km/h libre | congestión ${fused.congestionRatio !== null ? Math.round(fused.congestionRatio * 100) : '?'}% | fuentes: ${fused.sources.join('+')} | incidentes: ${fused.incidentCount}`
    );
  }, [stationId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!stationId) return;
    if (!GKEY && !TOMTOM_KEY && !HERE_KEY) return;

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [stationId, intervalMs, poll]);

  return {
    traffic,
    isConnected: traffic !== null && (traffic.sourceCount || 0) > 0,
    sourceCount: traffic?.sourceCount || 0,
    sources: traffic?.sources || [],
  };
}

// ═══════════════════════════════════════════════════════
// GLOBAL POLLING — 37 peajes en rotación escalonada
// ═══════════════════════════════════════════════════════
// Estrategia para no exceder free tiers:
// - TomTom: 37 peajes cada 5 min = 444/hora = 10,656/día (free: 2,500 → se pasa)
//   → Solución: TomTom cada 5 min para TODOS, Google solo para peaje abierto, HERE cada 10 min
// - Polling escalonado: 2-3 peajes cada 10 segundos en round-robin
//   → Todos se actualizan en ~2 min, pero las requests se distribuyen
const ALL_STATIONS = Object.keys(TOLL_SEGMENTS);
const globalTrafficStore = {}; // { stationId: fusedData }

let globalPollingStarted = false;
let globalRRIndex = 0;

async function pollOneStation(stationId) {
  // TomTom siempre (gratis, rápido, fiable)
  const tomtom = await fetchTomTom(stationId);

  // Google: solo si el cache expiró (TTL más largo: 5 min para ahorrar)
  const googleCacheEntry = googleCache[stationId];
  const googleExpired = !googleCacheEntry || Date.now() - googleCacheEntry.ts > 300000;
  const google = GKEY && googleExpired ? await fetchGoogle(stationId) : googleCacheEntry?.data || null;

  // HERE: solo si el cache expiró (TTL 10 min)
  const hereCacheEntry = hereCache[stationId];
  const hereExpired = !hereCacheEntry || Date.now() - hereCacheEntry.ts > 600000;
  const here = HERE_KEY && hereExpired ? await fetchHereIncidents(stationId) : hereCacheEntry?.data || null;

  // Waze: datos globales ya en cache (TTL 3 min), solo filtrar por estación
  const allWazeAlerts = wazeFeedCache.data || await fetchWazeFeed();
  const allWazeJams = wazeTvtCache.data || await fetchWazeTvt();
  const wazeFeed = getWazeAlertsForStation(allWazeAlerts, stationId);
  const wazeTvt = getWazeJamsForStation(allWazeJams, stationId);

  const fused = fuseTrafficData(google, tomtom, here, wazeFeed, wazeTvt);
  globalTrafficStore[stationId] = fused;
  return fused;
}

function startGlobalPolling() {
  if (globalPollingStarted) return;
  if (!GKEY && !TOMTOM_KEY && !HERE_KEY) return;
  globalPollingStarted = true;

  console.log(`[VIITS Traffic] 🌐 Iniciando polling global: ${ALL_STATIONS.length} peajes`);

  // Poll 2 stations every 4 seconds → all 37 done in ~74 seconds → cycle repeats
  const BATCH_SIZE = 2;
  const INTERVAL_MS = 4000; // 4s between batches

  setInterval(async () => {
    for (let b = 0; b < BATCH_SIZE; b++) {
      const stationId = ALL_STATIONS[globalRRIndex % ALL_STATIONS.length];
      globalRRIndex++;
      try {
        await pollOneStation(stationId);
      } catch (e) {
        console.warn(`[VIITS] polling ${stationId} failed:`, e.message);
      }
    }
  }, INTERVAL_MS);

  // Initial burst: poll all stations sequentially with small delay
  (async () => {
    for (let i = 0; i < ALL_STATIONS.length; i++) {
      try {
        await pollOneStation(ALL_STATIONS[i]);
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 800)); // 800ms between initial polls
    }
    console.log(`[VIITS Traffic] 🌐 Primera ronda completa: ${ALL_STATIONS.length} peajes consultados`);
  })();
}

/**
 * Hook: obtener datos de tráfico real para CUALQUIER peaje
 * Si el polling global ya está corriendo, devuelve datos del store
 * Si no, inicia el polling global automáticamente
 */
export function useGlobalTraffic(stationId) {
  const [data, setData] = useState(null);

  useEffect(() => {
    startGlobalPolling();

    // Check store periodically for updates
    const check = () => {
      const d = globalTrafficStore[stationId];
      if (d) setData(d);
    };
    check();
    const id = setInterval(check, 3000); // check every 3s
    return () => clearInterval(id);
  }, [stationId]);

  return {
    traffic: data,
    isConnected: data !== null && (data.sourceCount || 0) > 0,
    sourceCount: data?.sourceCount || 0,
    sources: data?.sources || [],
  };
}

/**
 * Hook: obtener snapshot de TODOS los 37 peajes
 * Para usar en el Monitor principal (panel global)
 */
export function useAllTrafficData() {
  const [snapshot, setSnapshot] = useState({});

  useEffect(() => {
    startGlobalPolling();
    const id = setInterval(() => {
      setSnapshot({ ...globalTrafficStore });
    }, 5000); // refresh snapshot every 5s
    return () => clearInterval(id);
  }, []);

  return {
    data: snapshot,
    stationCount: Object.keys(snapshot).length,
    totalStations: ALL_STATIONS.length,
  };
}

// ── Export lista de estaciones con segmento para verificar cobertura ──
export const SUPPORTED_STATIONS = ALL_STATIONS;

// ═══════════════════════════════════════════════════════
// HOURLY SNAPSHOT — Análisis cada hora para sincronizar con realidad
// Registra el estado de congestión de las APIs cada hora en localStorage
// Permite al sistema ajustar IRT basado en datos reales acumulados
// ═══════════════════════════════════════════════════════
const LS_HOURLY_KEY = 'viits_hourly_traffic';

function getColHourForSnapshot() {
  return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }), 10);
}

function getColDateForSnapshot() {
  const now = new Date();
  const y = now.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Bogota' });
  const m = now.toLocaleString('en-US', { month: '2-digit', timeZone: 'America/Bogota' });
  const d = now.toLocaleString('en-US', { day: '2-digit', timeZone: 'America/Bogota' });
  return `${y}-${m}-${d}`;
}

let lastSnapshotHour = -1;

function saveHourlySnapshot() {
  const hour = getColHourForSnapshot();
  if (hour === lastSnapshotHour) return; // Ya se guardó esta hora
  lastSnapshotHour = hour;

  const dateStr = getColDateForSnapshot();
  const snapshot = {};
  let totalCongestion = 0;
  let stationsWithData = 0;

  ALL_STATIONS.forEach(sid => {
    const d = globalTrafficStore[sid];
    if (d && d.congestionRatio != null) {
      snapshot[sid] = {
        speed: d.currentSpeed,
        congestion: Math.round(d.congestionRatio * 100),
        sources: d.sources?.join('+') || '?',
        wazeJamLevel: d.wazeJamLevel,
        wazeJamKm: d.wazeJamLengthKm,
        incidents: d.incidentCount,
      };
      totalCongestion += d.congestionRatio;
      stationsWithData++;
    }
  });

  const avgCongestion = stationsWithData > 0 ? Math.round((totalCongestion / stationsWithData) * 100) : 0;

  try {
    const raw = localStorage.getItem(LS_HOURLY_KEY);
    const history = raw ? JSON.parse(raw) : {};
    if (!history[dateStr]) history[dateStr] = {};
    history[dateStr][hour] = {
      timestamp: new Date().toISOString(),
      avgCongestion,
      stationsWithData,
      totalStations: ALL_STATIONS.length,
      snapshot,
    };

    // Limpiar días > 3
    const dates = Object.keys(history).sort();
    while (dates.length > 3) { delete history[dates.shift()]; }

    localStorage.setItem(LS_HOURLY_KEY, JSON.stringify(history));
    console.log(`[VIITS Hourly] 📊 Snapshot hora ${hour}:00 — congestión promedio: ${avgCongestion}% — ${stationsWithData}/${ALL_STATIONS.length} estaciones con datos`);
  } catch (e) {
    console.warn('[VIITS Hourly] Error guardando snapshot:', e.message);
  }
}

// Ejecutar snapshot cada 5 minutos (captura el cambio de hora)
setInterval(saveHourlySnapshot, 300000);
// Primera ejecución inmediata
setTimeout(saveHourlySnapshot, 10000);

/**
 * Hook: obtener historial horario del día
 * Para que componentes puedan ver la evolución real de congestión
 */
export function useHourlyTrafficHistory() {
  const [history, setHistory] = useState({});

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem(LS_HOURLY_KEY);
        setHistory(raw ? JSON.parse(raw) : {});
      } catch { setHistory({}); }
    }
    load();
    const id = setInterval(load, 60000); // refresh cada minuto
    return () => clearInterval(id);
  }, []);

  return history;
}

export default useTrafficAPI;
