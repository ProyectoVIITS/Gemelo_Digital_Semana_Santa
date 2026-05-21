/**
 * departmentClassifier.js — Asigna cada jam Waze a un departamento de Colombia.
 *
 * Estrategia:
 *   1. Calcula centroide de la polilínea Waze (jam.line[]).
 *   2. Caso especial: si está dentro del bbox de Bogotá D.C. (enclave
 *      urbano dentro de Cundinamarca) → 'Bogotá D.C.'
 *   3. Caso general: nearest-centroid haversine entre los 33 departamentos.
 *
 * Cache LRU por jam.uuid/id para evitar recomputar en cada render. La
 * polilínea de un jam no cambia (es geometría fija de la vía), así que
 * la clasificación es estable mientras el jam viva.
 */

import { COLOMBIA_DEPARTMENTS, BOGOTA_DC_BBOX } from '../data/colombiaDepartments';

const cache = new Map();
const CACHE_MAX = 2000;

function jamCenter(jam) {
  const line = jam && jam.line;
  if (!line || !line.length) return null;
  const mid = line[Math.floor(line.length / 2)];
  if (mid && mid.x != null && mid.y != null) {
    return { lat: mid.y, lon: mid.x };
  }
  // Fallback: promedio de todos los puntos válidos
  let sumLat = 0, sumLon = 0, n = 0;
  for (const p of line) {
    if (p && p.x != null && p.y != null) {
      sumLat += p.y;
      sumLon += p.x;
      n++;
    }
  }
  return n > 0 ? { lat: sumLat / n, lon: sumLon / n } : null;
}

function inBogotaBBox(lat, lon) {
  return (
    lat >= BOGOTA_DC_BBOX.minLat &&
    lat <= BOGOTA_DC_BBOX.maxLat &&
    lon >= BOGOTA_DC_BBOX.minLon &&
    lon <= BOGOTA_DC_BBOX.maxLon
  );
}

// Distancia angular cuadrática (suficiente para nearest-neighbor — evita sqrt).
function dist2(lat1, lon1, lat2, lon2) {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return dLat * dLat + dLon * dLon;
}

const UNKNOWN = { code: '00', name: 'Sin clasificar', centroid: null };

export function classifyJam(jam) {
  if (!jam) return UNKNOWN;
  const id = jam.uuid || jam.id;
  if (id != null && cache.has(id)) return cache.get(id);

  const center = jamCenter(jam);
  if (!center) {
    if (id != null) cacheSet(id, UNKNOWN);
    return UNKNOWN;
  }

  // Caso especial enclave Bogotá D.C.
  if (inBogotaBBox(center.lat, center.lon)) {
    const bogota = COLOMBIA_DEPARTMENTS.find((d) => d.code === '11') || UNKNOWN;
    if (id != null) cacheSet(id, bogota);
    return bogota;
  }

  // Nearest-centroid
  let best = UNKNOWN;
  let bestD = Infinity;
  for (const d of COLOMBIA_DEPARTMENTS) {
    if (!d.centroid) continue;
    const dd = dist2(center.lat, center.lon, d.centroid.lat, d.centroid.lon);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }

  if (id != null) cacheSet(id, best);
  return best;
}

function cacheSet(id, value) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(id, value);
}

// Agrupa una lista de jams por departamento. Devuelve un array ordenado
// descendente por count.
export function groupJamsByDepartment(jams) {
  if (!Array.isArray(jams)) return [];
  const buckets = new Map();
  for (const jam of jams) {
    const dept = classifyJam(jam);
    const key = dept.code;
    if (!buckets.has(key)) {
      buckets.set(key, { dept, jams: [] });
    }
    buckets.get(key).jams.push(jam);
  }
  const arr = Array.from(buckets.values());
  arr.sort((a, b) => b.jams.length - a.jams.length);
  return arr;
}
