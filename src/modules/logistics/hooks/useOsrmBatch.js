/**
 * VIITS-NEXUS · Módulo Logística · useOsrmBatch
 * ──────────────────────────────────────────────
 * Recupera la geometría real (OSRM) de N segmentos en paralelo con un
 * pool limitado de concurrencia. Cache compartido con useOsrmGeometry
 * en sessionStorage por la misma convención de clave.
 *
 * Útil para el heatmap nacional, que tiene ~40 segmentos.
 *
 * Devuelve { geometryMap, isLoading, loadedCount, totalCount }.
 *   - geometryMap[segmentId] = [[lat, lng], ...] cuando OSRM responde
 *   - Si OSRM falla para un segmento, ese segmento NO entra al map
 *     (el caller usa segment.polyline como fallback graceful).
 *   - El render arranca con segmentos vacíos y se va completando a
 *     medida que las polylines llegan — sin bloquear el primer paint.
 */
import { useEffect, useRef, useState } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_PREFIX = 'iris-osrm:v1:';
const CONCURRENCY = 4; // parallel fetches max — respeta el rate limit del demo público

function cacheKey(waypoints) {
  return CACHE_PREFIX + waypoints.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join('|');
}
function readCache(key) {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function writeCache(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { /* sessionStorage lleno */ }
}

async function fetchOne(polyline, signal) {
  const coords = polyline.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&continue_straight=true`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const c = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) throw new Error('no-geometry');
  return c.map(([lng, lat]) => [lat, lng]);
}

/**
 * Acepta un array de { id, polyline } y devuelve la geometría detallada
 * por id. Va completando incrementalmente: la UI puede renderizar lo que
 * tenga disponible.
 */
export default function useOsrmBatch(segments) {
  const [state, setState] = useState({
    geometryMap: {},
    isLoading: false,
    loadedCount: 0,
    totalCount: 0,
  });
  const abortRef = useRef(null);

  // Clave de invalidación: ids ordenados de los segmentos
  const segmentsKey = Array.isArray(segments)
    ? segments.map((s) => s.id).sort().join('|')
    : '';

  useEffect(() => {
    if (!Array.isArray(segments) || segments.length === 0) {
      setState({ geometryMap: {}, isLoading: false, loadedCount: 0, totalCount: 0 });
      return undefined;
    }

    // Aborta cualquier batch previo (cambio de corridors)
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 1) Hidratar desde cache lo que ya esté disponible — sin red.
    const initialMap = {};
    const pending = [];
    for (const seg of segments) {
      if (!Array.isArray(seg.polyline) || seg.polyline.length < 2) continue;
      const k = cacheKey(seg.polyline);
      const cached = readCache(k);
      if (cached && Array.isArray(cached) && cached.length >= 2) {
        initialMap[seg.id] = cached;
      } else {
        pending.push(seg);
      }
    }

    setState({
      geometryMap: initialMap,
      isLoading: pending.length > 0,
      loadedCount: Object.keys(initialMap).length,
      totalCount: segments.length,
    });

    if (pending.length === 0) return () => controller.abort();

    // 2) Worker pool: lanza CONCURRENCY fetches concurrentes hasta agotar.
    let cursor = 0;
    const next = async () => {
      while (cursor < pending.length) {
        if (controller.signal.aborted) return;
        const i = cursor++;
        const seg = pending[i];
        try {
          const geometry = await fetchOne(seg.polyline, controller.signal);
          writeCache(cacheKey(seg.polyline), geometry);
          setState((prev) => ({
            ...prev,
            geometryMap: { ...prev.geometryMap, [seg.id]: geometry },
            loadedCount: prev.loadedCount + 1,
          }));
        } catch (err) {
          if (err.name === 'AbortError') return;
          // silenciar: el caller usa fallback de segment.polyline
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => next());
    Promise.all(workers).then(() => {
      if (!controller.signal.aborted) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    });

    return () => controller.abort();
  // eslint-disable-next-line
  }, [segmentsKey]);

  return state;
}
