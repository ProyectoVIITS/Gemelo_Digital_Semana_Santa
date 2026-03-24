/**
 * useTrafficAPI — 3 APIs de tráfico real → simulación VIITS NEXUS
 *
 * 1. Google Routes API   → velocidad real + congestión (cada 2 min)
 * 2. TomTom Traffic Flow → velocidad por segmento + confianza (cada 2 min)
 * 3. HERE Traffic        → incidentes reales: accidentes, cierres, obras (cada 2 min)
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
// FUSIÓN — Combina las 3 APIs en un solo estado
// ═══════════════════════════════════════════════════════
function fuseTrafficData(google, tomtom, here) {
  // Velocidad: promedio ponderado Google (50%) + TomTom (50%). Si solo hay una, usar esa.
  let currentSpeed = null;
  let freeFlowSpeed = null;
  let congestionRatio = null;
  let confidence = 0;

  const speeds = [];
  const freeFlows = [];
  const congestions = [];

  if (google) {
    speeds.push({ val: google.currentSpeed, w: 0.5 });
    freeFlows.push({ val: google.freeFlowSpeed, w: 0.5 });
    congestions.push({ val: google.congestionRatio, w: 0.5 });
    confidence += 0.5;
  }
  if (tomtom) {
    const ttConf = Math.min(tomtom.confidence || 0.5, 1);
    speeds.push({ val: tomtom.currentSpeed, w: 0.5 * ttConf });
    freeFlows.push({ val: tomtom.freeFlowSpeed, w: 0.5 * ttConf });
    congestions.push({ val: tomtom.congestionRatio, w: 0.5 * ttConf });
    confidence += 0.5 * ttConf;
  }

  if (speeds.length > 0) {
    const totalW = speeds.reduce((s, x) => s + x.w, 0);
    currentSpeed = Math.round(speeds.reduce((s, x) => s + x.val * x.w, 0) / totalW);
    freeFlowSpeed = Math.round(freeFlows.reduce((s, x) => s + x.val * x.w, 0) / totalW);
    congestionRatio = Math.min(1, congestions.reduce((s, x) => s + x.val * x.w, 0) / totalW);
  }

  // Incidentes de HERE
  const incidents = here?.incidents || [];
  const hasRoadClosure = here?.hasRoadClosure || tomtom?.roadClosure || false;

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

  return {
    // Velocidad fusionada
    currentSpeed: currentSpeed ?? null,
    freeFlowSpeed: freeFlowSpeed ?? null,
    congestionRatio: congestionRatio ?? null,
    confidence: Math.min(confidence, 1),

    // Incidentes reales
    incidents,
    incidentCount: incidents.length,
    hasRoadClosure,
    hasMajorIncident: here?.hasMajorIncident || false,

    // Delay
    delayMin: google?.delayMin || 0,

    // Meta
    sources,
    sourceCount: sources.length,
    timestamp: new Date().toISOString(),

    // Datos crudos por API (para debug)
    _google: google,
    _tomtom: tomtom,
    _here: here,
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
    if (!GKEY && !TOMTOM_KEY && !HERE_KEY) return; // No keys configured

    // Lanzar las 3 APIs en PARALELO
    const [google, tomtom, here] = await Promise.all([
      fetchGoogle(stationId),
      fetchTomTom(stationId),
      fetchHereIncidents(stationId),
    ]);

    if (!mountedRef.current) return;

    const fused = fuseTrafficData(google, tomtom, here);
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
  const googleExpired = !googleCacheEntry || Date.now() - googleCacheEntry.ts > 300000; // 5 min
  const google = GKEY && googleExpired ? await fetchGoogle(stationId) : googleCacheEntry?.data || null;

  // HERE: solo si el cache expiró (TTL 10 min — incidentes no cambian cada 2 min)
  const hereCacheEntry = hereCache[stationId];
  const hereExpired = !hereCacheEntry || Date.now() - hereCacheEntry.ts > 600000; // 10 min
  const here = HERE_KEY && hereExpired ? await fetchHereIncidents(stationId) : hereCacheEntry?.data || null;

  const fused = fuseTrafficData(google, tomtom, here);
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

export default useTrafficAPI;
