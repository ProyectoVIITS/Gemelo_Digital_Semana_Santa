import { useState, useEffect, useRef } from 'react';
import { HIGH_RISK_TOLLS } from '../../../data/nexusCorridors';

// Base IRT por peaje (ajusta con datos reales cuando estén disponibles)
const BASE_IRT = {
  'C1-07': 58, 'C1-08': 45,
  'C2-03': 42,
  'C3-01': 55, 'C3-02': 60,
  'C4-02': 52, 'C4-03': 52,
  'C5-02': 58,
  'C6-02': 48,
  'C7-03': 38,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (range) => (Math.random() - 0.5) * range;

function generateAlertMessage(irt) {
  const msgs = irt > 70
    ? [
        'Cola > 8 veh detectada',
        'Velocidad media < 40 km/h',
        'Incidente reportado por CCTV',
        'Vehículo averiado en calzada',
      ]
    : [
        `Vehículo sobrepeso: ${(30 + Math.random() * 14).toFixed(1)}t (límite: 32t)`,
        `Cola moderada: ${3 + Math.round(Math.random() * 3)} veh`,
        'Flujo aumentando: +18%',
      ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function buildSnapshot(irt, stationId) {
  const speed = clamp(Math.round(85 - irt * 0.62 + rnd(10)), 15, 110);
  const flow = clamp(Math.round(260 + irt * 2.8 + rnd(25)), 100, 580);
  const occup = clamp(Math.round(irt * 0.78 + 14 + rnd(5)), 5, 95);
  const c4closed = irt > 82;

  const lanes = [
    { id: 1, label: 'C1', type: 'FacilPass', status: 'active', active: true, speed: clamp(Math.round(speed + 8 + rnd(8)), 15, 110), queue: clamp(Math.round((irt - 30) / 12 + rnd(1.5)), 0, 8) },
    { id: 2, label: 'C2', type: 'FacilPass', status: 'active', active: true, speed: clamp(Math.round(speed + 12 + rnd(6)), 15, 110), queue: clamp(Math.round((irt - 35) / 14 + rnd(1.5)), 0, 8) },
    { id: 3, label: 'C3', type: 'Efectivo', status: 'active', active: true, speed: clamp(Math.round(speed - 5 + rnd(8)), 15, 110), queue: clamp(Math.round((irt - 25) / 10 + rnd(2)), 0, 8) },
    { id: 4, label: 'C4', type: 'Efectivo', status: c4closed ? 'closed' : 'active', active: !c4closed, speed: c4closed ? 0 : clamp(Math.round(speed - 8 + rnd(6)), 15, 110), queue: 0 },
  ];

  const metrics = {
    vehiclesTotal: 1300 + Math.round(Math.random() * 900),
    vehiclesHour: flow,
    avgSpeed: speed,
    occupancy: occup,
    irt: Math.round(irt),
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  // Historial inicial: últimas 2h con curva realista
  const now = new Date();
  const speedHistory = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 5 * 60 * 1000);
    const s = clamp(speed + Math.sin(i / 4) * 12 + rnd(10), 20, 110);
    return {
      time: t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
      avgSpeed: Math.round(s),
      limit: 80,
      violations: s > 80 ? Math.round(Math.random() * 5) : 0,
    };
  });

  return { lanes, metrics, speedHistory, alerts: [] };
}

function updateHistory(prev, irt) {
  const speed = clamp(Math.round(85 - irt * 0.62 + rnd(10)), 15, 110);
  const now = new Date();
  const point = {
    time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
    avgSpeed: speed,
    limit: 80,
    violations: speed > 80 ? Math.round(Math.random() * 4) : 0,
  };
  return [...prev.slice(-23), point];
}

export default function useTollData(stationId, corridorId) {
  const baseIRT = BASE_IRT[stationId] ?? 40;
  const isHighRisk = HIGH_RISK_TOLLS.includes(stationId);

  const [data, setData] = useState(() => buildSnapshot(baseIRT, stationId));
  const alertIdRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const jitter = (Math.random() - 0.48) * 8;
      const irt = clamp(baseIRT + jitter, 5, 95);

      setData(prev => {
        const newAlerts = [];
        const alertProb = isHighRisk ? 0.05 : 0.02;
        if (Math.random() < alertProb) {
          newAlerts.push({
            id: String(++alertIdRef.current),
            severity: irt > 70 ? 'critical' : 'warning',
            message: generateAlertMessage(irt),
            timestamp: new Date(),
            resolved: false,
            source: Math.random() > 0.5 ? 'CCTV' : 'CONTEO',
          });
        }

        const snapshot = buildSnapshot(irt, stationId);
        return {
          ...snapshot,
          speedHistory: updateHistory(prev.speedHistory, irt),
          alerts: [...newAlerts, ...prev.alerts].slice(0, 8),
        };
      });
    }, 1800);

    return () => clearInterval(id);
  }, [baseIRT, stationId, isHighRisk]);

  return data;
}
