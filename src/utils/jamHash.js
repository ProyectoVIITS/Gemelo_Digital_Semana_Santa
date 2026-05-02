/**
 * jamHash.js — Replica en JS de compute_jam_hash() del backend Python
 *
 * Genera el id de 12 chars que identifica unívocamente una vía/jam,
 * derivado de 3 puntos de la polilínea Waze (primero, medio, último).
 * Debe producir el MISMO hash que sumo-engine/calibrator.py y
 * sumo-engine/scripts/generate_network.py para que el frontend pueda
 * pedir /ws/sumo/{HASH} sin coordinarse con el backend.
 *
 * Equivalencia Python:
 *   key_points = [line[0], line[len(line)//2], line[-1]]
 *   key_str = "|".join(f"{p['y']:.4f},{p['x']:.4f}" for p in key_points)
 *   md5(key_str)[:12]
 */

import SparkMD5 from 'spark-md5';

export function computeJamHash(jam) {
  const line = jam?.line || [];
  if (!line.length) {
    return SparkMD5.hash(JSON.stringify(jam?.name || '')).slice(0, 12);
  }
  const keyPoints = [
    line[0],
    line[Math.floor(line.length / 2)],
    line[line.length - 1],
  ];
  const keyStr = keyPoints
    .map((p) => `${(p?.y ?? 0).toFixed(4)},${(p?.x ?? 0).toFixed(4)}`)
    .join('|');
  return SparkMD5.hash(keyStr).slice(0, 12);
}
