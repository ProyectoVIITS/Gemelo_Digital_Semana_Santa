/**
 * useTrafficAPI — Google Routes API → datos reales directo a simulación
 * Consulta velocidad real del tráfico cerca del peaje cada 2 minutos
 * Los datos alimentan useTollData y TollCanvas (sin paneles extra)
 */
import { useState, useEffect, useRef } from 'react';

const GKEY = process.env.REACT_APP_GOOGLE_ROUTES_KEY || '';

// Puntos de consulta: origen/destino cortos (~2km) alrededor de cada peaje
// Google Routes devuelve duration vs staticDuration → inferimos velocidad real
// Segmentos por station ID (como vienen de nexusCorridors.js)
const TOLL_SEGMENTS = {
  // C3: Bogotá – Girardot
  'C3-01':   { o: { lat: 4.5410, lng: -74.2680 }, d: { lat: 4.5330, lng: -74.2760 }, dist: 1.2, freeSpeed: 60 }, // Chuzacá
  'C3-02':   { o: { lat: 4.3030, lng: -74.4310 }, d: { lat: 4.2940, lng: -74.4390 }, dist: 1.3, freeSpeed: 60 }, // Chinauta
  'C3-03':   { o: { lat: 3.8690, lng: -74.8260 }, d: { lat: 3.8610, lng: -74.8340 }, dist: 1.1, freeSpeed: 60 }, // Pubenza
  'C3-04':   { o: { lat: 4.0520, lng: -74.8120 }, d: { lat: 4.0430, lng: -74.8200 }, dist: 1.2, freeSpeed: 60 }, // Flandes
  // C1: Medellín – Honda – Bogotá
  'C1-07':   { o: { lat: 4.7470, lng: -74.1610 }, d: { lat: 4.7380, lng: -74.1700 }, dist: 1.4, freeSpeed: 70 }, // Siberia
  'C1-03':   { o: { lat: 5.2110, lng: -74.7330 }, d: { lat: 5.2030, lng: -74.7410 }, dist: 1.2, freeSpeed: 60 }, // Honda
  'C1-08':   { o: { lat: 5.5200, lng: -74.5800 }, d: { lat: 5.5120, lng: -74.5880 }, dist: 1.2, freeSpeed: 60 }, // Andes
  // C5: Bogotá – Villavicencio
  'C5-01':   { o: { lat: 4.3730, lng: -73.8960 }, d: { lat: 4.3690, lng: -73.9000 }, dist: 1.3, freeSpeed: 60 }, // Naranjal
  'C5-02':   { o: { lat: 4.3300, lng: -73.8200 }, d: { lat: 4.3220, lng: -73.8280 }, dist: 1.2, freeSpeed: 60 }, // Pipiral
  // C7: Bogotá – Tunja
  'C7-01':   { o: { lat: 5.0540, lng: -73.7760 }, d: { lat: 5.0460, lng: -73.7840 }, dist: 1.2, freeSpeed: 70 }, // Albarracín
};

const cache = {};
const CACHE_TTL = 120000; // 2 min

/**
 * Consulta Google Routes API para un segmento de vía
 * Retorna { currentSpeed, freeFlowSpeed, congestionRatio }
 */
async function fetchRouteTraffic(stationId) {
  if (!GKEY) return null;
  const seg = TOLL_SEGMENTS[stationId];
  if (!seg) return null;

  const ck = stationId;
  if (cache[ck] && Date.now() - cache[ck].ts < CACHE_TTL) return cache[ck].data;

  try {
    const body = {
      origin: { location: { latLng: { latitude: seg.o.lat, longitude: seg.o.lng } } },
      destination: { location: { latLng: { latitude: seg.d.lat, longitude: seg.d.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GKEY,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[VIITS Traffic] Google Routes error:', res.status, errText);
      return null;
    }

    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;

    // duration incluye tráfico real, staticDuration es sin tráfico
    const durationSec = parseInt(route.duration?.replace('s', '') || '0', 10);
    const staticSec = parseInt(route.staticDuration?.replace('s', '') || '0', 10);
    const distM = route.distanceMeters || (seg.dist * 1000);
    const distKm = distM / 1000;

    // Velocidad actual = distancia / tiempo con tráfico
    const currentSpeed = durationSec > 0 ? Math.round((distKm / (durationSec / 3600))) : seg.freeSpeed;
    // Velocidad flujo libre = distancia / tiempo sin tráfico
    const freeFlowSpeed = staticSec > 0 ? Math.round((distKm / (staticSec / 3600))) : seg.freeSpeed;
    // Ratio de congestión
    const congestionRatio = Math.max(0, Math.min(1, 1 - (currentSpeed / Math.max(freeFlowSpeed, 1))));

    console.log(`[VIITS Traffic] ✅ ${stationId}: ${currentSpeed} km/h real | ${freeFlowSpeed} km/h libre | congestión ${Math.round(congestionRatio*100)}%`);

    const data = {
      currentSpeed: Math.max(currentSpeed, 0),
      freeFlowSpeed: Math.max(freeFlowSpeed, 1),
      congestionRatio,
      durationSec,
      staticDurationSec: staticSec,
      distanceKm: distKm,
      // Delay en minutos respecto a flujo libre
      delayMin: Math.max(0, Math.round((durationSec - staticSec) / 60 * 10) / 10),
      timestamp: new Date().toISOString(),
      source: 'Google Routes API',
    };

    cache[ck] = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.warn('[VIITS Traffic] fetch error:', err.message);
    return null;
  }
}

/**
 * Hook: tráfico real para un peaje → alimenta simulación
 */
export function useTrafficAPI(stationId, intervalMs = 120000) {
  const [traffic, setTraffic] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!GKEY || !stationId) return;

    async function poll() {
      if (!mountedRef.current) return;
      const data = await fetchRouteTraffic(stationId);
      if (mountedRef.current && data) setTraffic(data);
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [stationId, intervalMs]);

  return {
    traffic,
    isConnected: !!GKEY && traffic !== null,
  };
}

export default useTrafficAPI;
