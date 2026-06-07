/**
 * VIITS-NEXUS · Módulo Logística · useOsrmGeometry
 * ─────────────────────────────────────────────────
 * Recupera la geometría real de la vía entre los waypoints de un segmento
 * usando el servicio público OSRM (router.project-osrm.org). Devuelve una
 * polyline detallada (cientos de puntos) que sigue el trazado real de la
 * carretera — curvas, descensos, variantes urbanas.
 *
 * Cache en sessionStorage por clave derivada de los coords para evitar
 * recargas durante la navegación.
 *
 * Si el fetch falla (rate limit, sin red, CORS), devuelve la polyline
 * original sin alteración — la página sigue funcionando con la línea recta
 * entre waypoints como degradación graceful.
 *
 * Notas:
 *  - OSRM público es solo demo. Para producción usar instancia propia.
 *  - El parámetro `geometries=geojson` devuelve [[lng, lat], ...] (orden
 *    GeoJSON), se transpone a [[lat, lng], ...] para react-leaflet.
 *  - El parámetro `overview=full` da máxima resolución (sin simplificación).
 */
import { useEffect, useRef, useState } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_PREFIX = 'iris-osrm:v1:';

function cacheKey(waypoints) {
  return CACHE_PREFIX + waypoints.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join('|');
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // sessionStorage lleno o no disponible — no es crítico
  }
}

/**
 * Hook principal. Acepta polyline en formato [[lat, lng], ...].
 * Devuelve { geometry, isLoading, source } donde source ∈ 'osrm' | 'fallback'.
 */
export default function useOsrmGeometry(polyline) {
  const [state, setState] = useState({
    geometry: polyline || [],
    isLoading: false,
    source: 'fallback',
  });
  const abortRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(polyline) || polyline.length < 2) {
      setState({ geometry: polyline || [], isLoading: false, source: 'fallback' });
      return undefined;
    }

    const key = cacheKey(polyline);
    const cached = readCache(key);
    if (cached && Array.isArray(cached) && cached.length >= 2) {
      setState({ geometry: cached, isLoading: false, source: 'osrm' });
      return undefined;
    }

    // Aborta cualquier fetch previo pendiente al cambiar de segmento.
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, isLoading: true }));

    const coords = polyline.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&continue_straight=true`;

    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) {
          throw new Error('No geometry in response');
        }
        // GeoJSON viene [lng, lat] — transponer a [lat, lng] para Leaflet.
        const geometry = coords.map(([lng, lat]) => [lat, lng]);
        writeCache(key, geometry);
        setState({ geometry, isLoading: false, source: 'osrm' });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Fallback silencioso: polyline original (línea recta).
        setState({ geometry: polyline, isLoading: false, source: 'fallback' });
      });

    return () => {
      controller.abort();
    };
  }, [JSON.stringify(polyline)]);

  return state;
}
