/**
 * useWazeSegmentData — Transforma jam de Waze TVT → formato TollCanvas
 * Permite simular tramos congestionados sin peaje físico
 */
import { useState, useEffect, useRef } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param {object} wazeJam — objeto jam del Waze TVT API
 * @returns {{ lanes, metrics, speedHistory, alerts }} — formato compatible con TollCanvas
 */
export default function useWazeSegmentData(wazeJam) {
  const [data, setData] = useState(() => buildFromJam(wazeJam));
  const prevJamRef = useRef(wazeJam);

  useEffect(() => {
    // Actualizar cuando cambia el jam (cada 3 min del polling Waze)
    if (wazeJam !== prevJamRef.current) {
      prevJamRef.current = wazeJam;
      setData(buildFromJam(wazeJam));
    }

    // Jitter cada 2s para simular variación de sensores
    const id = setInterval(() => {
      setData(prev => {
        if (!wazeJam) return prev;
        const jitter = (Math.random() - 0.5) * 4;
        return buildFromJam(wazeJam, jitter, prev.speedHistory);
      });
    }, 2000);
    return () => clearInterval(id);
  }, [wazeJam]);

  return data;
}

function buildFromJam(jam, jitter = 0, prevHistory = null) {
  if (!jam) return { lanes: [], metrics: {}, speedHistory: [], alerts: [] };

  const jamLevel = jam.jamLevel || 0;
  const lengthM = jam.length || 0;
  const timeSec = jam.time || 1;
  const historicSec = jam.historicTime || timeSec;
  const ratio = historicSec > 0 ? timeSec / historicSec : 1;
  const hasAccident = jam.leadAlert?.type === 'ACCIDENT';
  const isClosed = jam.leadAlert?.type === 'ROAD_CLOSED';

  // ── IRT derivado del jamLevel y ratio de delay ──
  const irtFromLevel = jamLevel * 18; // 0→0, 3→54, 4→72, 5→90
  const irtFromRatio = clamp(Math.round((ratio - 1) * 25), 0, 40);
  const irt = clamp(Math.round(irtFromLevel + irtFromRatio + jitter), 0, 100);

  // ── Velocidad derivada ──
  const freeSpeed = historicSec > 0 ? Math.round((lengthM / 1000) / (historicSec / 3600)) : 60;
  const currentSpeed = timeSec > 0 ? Math.round((lengthM / 1000) / (timeSec / 3600)) : freeSpeed;
  const avgSpeed = clamp(currentSpeed + Math.round(jitter), 2, 120);

  // ── Ocupación derivada de la longitud de cola ──
  const occupancy = isClosed ? 98 : clamp(Math.round((lengthM / 5000) * 80 + jamLevel * 8), 10, 98);

  // ── Lanes virtuales: 1 carril por cada 800m de jam, min 2, max 6 ──
  const laneCount = clamp(Math.ceil(lengthM / 800), 2, 6);
  const lanes = Array.from({ length: laneCount }, (_, i) => {
    const laneVar = ((i * 7 + 3) % 5) - 2;
    const laneSpeed = clamp(Math.round(avgSpeed + laneVar), 2, 80);
    const laneQueue = clamp(Math.round((irt / 10) * (1 + i * 0.3)), 0, 15);
    return {
      id: i + 1,
      label: `T${i + 1}`,
      type: jamLevel >= 4 ? 'Congestión' : 'Tráfico',
      status: 'active',
      active: true,
      speed: laneSpeed,
      queue: laneQueue,
      direction: 'salida',
    };
  });

  // ── Métricas ──
  const flowEstimate = clamp(Math.round(avgSpeed * 12 + 50), 20, 800);
  const metrics = {
    vehiclesTotal: Math.round(flowEstimate * 8 + Math.random() * 200),
    vehiclesHour: flowEstimate,
    avgSpeed,
    occupancy,
    irt,
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  // ── Speed history ──
  const now = new Date();
  const history = prevHistory && prevHistory.length > 0
    ? [...prevHistory.slice(-23), {
        time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
        avgSpeed: clamp(avgSpeed + Math.round((Math.random() - 0.5) * 6), 5, 100),
        limit: freeSpeed,
      }]
    : Array.from({ length: 24 }, (_, i) => ({
        time: new Date(now.getTime() - (23 - i) * 5 * 60 * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
        avgSpeed: clamp(Math.round(avgSpeed + (Math.random() - 0.5) * 12), 5, 100),
        limit: freeSpeed,
      }));

  // ── Alertas ──
  const alerts = [];
  if (hasAccident) {
    alerts.push({
      id: `waze-acc-${jam.id}`,
      severity: 'critical',
      message: `⚠ Accidente reportado por Waze — ${jam.name || 'vía'}`,
      timestamp: new Date(),
      source: 'Waze',
    });
  }
  if (isClosed) {
    alerts.push({
      id: `waze-close-${jam.id}`,
      severity: 'emergency',
      message: `🚫 Vía cerrada — ${jam.name || 'tramo'}`,
      timestamp: new Date(),
      source: 'Waze',
    });
  }
  if (jamLevel >= 4 && !hasAccident) {
    alerts.push({
      id: `waze-jam-${jam.id}`,
      severity: 'warning',
      message: `Cola de ${(lengthM / 1000).toFixed(1)} km — ${Math.round(timeSec / 60)} min (normal: ${Math.round(historicSec / 60)} min)`,
      timestamp: new Date(),
      source: 'Waze',
    });
  }

  return { lanes, metrics, speedHistory: history, alerts };
}
