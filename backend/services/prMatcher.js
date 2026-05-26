/**
 * prMatcher.js — Asocia jams Waze con Puntos de Referencia (PR) INVÍAS.
 *
 * Carga 17,405 PRs del archivo backend/data/prCoordenadas.json al startup
 * y construye un grid hash espacial (celdas de 0.02° ≈ 2.2 km) para
 * lookup nearest-neighbor en O(9) celdas por query.
 *
 * Uso típico:
 *   const { matchPR } = require('./prMatcher');
 *   const pr = matchPR(jamLat, jamLon);
 *   // pr = { display:'PR 6512-78', via, pr, lat, lon, distanciaM } | null
 *
 * Cache LRU por uuid evita recomputar para jams ya vistos. La geometría
 * de un jam no cambia mientras vive, así que el PR asignado es estable.
 *
 * Threshold: si la distancia al PR más cercano > MAX_MATCH_DISTANCE_M
 * (2 km), devolvemos null. Eso filtra vías urbanas donde INVÍAS no
 * instala PRs y un match lejano sería engañoso.
 */

const path = require('path');
const fs = require('fs');

const MAX_MATCH_DISTANCE_M = 2000;
const CELL_SIZE_DEG = 0.02; // ≈ 2.2 km a estas latitudes
const CACHE_MAX = 5000;

let grid = null;       // Map<string, PR[]>
let prCount = 0;
const matchCache = new Map(); // uuid -> match (incluye null)

function loadPRs() {
  const file = path.join(__dirname, '..', 'data', 'prCoordenadas.json');
  if (!fs.existsSync(file)) {
    console.warn('[PR-Matcher] prCoordenadas.json no encontrado:', file);
    return;
  }
  let prs;
  try {
    prs = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[PR-Matcher] Error parseando JSON:', e.message);
    return;
  }
  if (!Array.isArray(prs)) return;

  grid = new Map();
  for (const pr of prs) {
    if (pr.lat == null || pr.lon == null) continue;
    const k = cellKey(pr.lat, pr.lon);
    let bucket = grid.get(k);
    if (!bucket) {
      bucket = [];
      grid.set(k, bucket);
    }
    bucket.push(pr);
  }
  prCount = prs.length;
  console.log(`[PR-Matcher] ${prCount} PRs cargados en ${grid.size} celdas (${CELL_SIZE_DEG}°).`);
}

function cellKey(lat, lon) {
  const ci = Math.floor(lat / CELL_SIZE_DEG);
  const cj = Math.floor(lon / CELL_SIZE_DEG);
  return `${ci}|${cj}`;
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Devuelve el PR más cercano a (lat, lon) si está dentro del umbral, o null.
 * Búsqueda en celda + 8 adyacentes (área ~6.6 km × 6.6 km).
 */
function findNearestPR(lat, lon) {
  if (!grid || lat == null || lon == null) return null;
  const ci = Math.floor(lat / CELL_SIZE_DEG);
  const cj = Math.floor(lon / CELL_SIZE_DEG);

  let best = null;
  let bestD = Infinity;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const bucket = grid.get(`${ci + di}|${cj + dj}`);
      if (!bucket) continue;
      for (const pr of bucket) {
        const d = haversineM(lat, lon, pr.lat, pr.lon);
        if (d < bestD) {
          bestD = d;
          best = pr;
        }
      }
    }
  }
  if (!best || bestD > MAX_MATCH_DISTANCE_M) return null;
  return {
    display: `PR ${best.via}-${best.pr}`,
    via: best.via,
    pr: best.pr,
    lat: best.lat,
    lon: best.lon,
    distanciaM: Math.round(bestD),
  };
}

/**
 * matchPR — versión cacheada por uuid. La polilínea de un jam es estable
 * mientras vive, así que el PR asignado se cachea para evitar recomputar.
 *
 * @param {object} jam - Objeto Waze TVT (espera jam.line[], jam.uuid|id)
 * @returns {object|null} PR match o null si no hay cerca
 */
function matchPR(jam) {
  if (!jam) return null;
  const line = jam.line;
  if (!Array.isArray(line) || line.length === 0) return null;

  const id = jam.uuid || jam.id;
  if (id != null && matchCache.has(id)) return matchCache.get(id);

  const mid = line[Math.floor(line.length / 2)];
  if (!mid || mid.x == null || mid.y == null) {
    if (id != null) cacheSet(id, null);
    return null;
  }
  const result = findNearestPR(mid.y, mid.x);
  if (id != null) cacheSet(id, result);
  return result;
}

function cacheSet(id, value) {
  if (matchCache.size >= CACHE_MAX) {
    const firstKey = matchCache.keys().next().value;
    matchCache.delete(firstKey);
  }
  matchCache.set(id, value);
}

// Cargar al require()
loadPRs();

module.exports = { matchPR, findNearestPR, MAX_MATCH_DISTANCE_M };
