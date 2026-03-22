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

// Perfil horario SEMANA SANTA — fin de semana largo
// Patrón especial: salidas de Bogotá altamente ocupadas en todo el horario diurno (7am-8pm)
// No solo picos AM/PM sino flujo sostenido alto durante el día
// Fuente: análisis INVÍAS operación retorno / operación salida festivos
const HOURLY_FLOW_PROFILE = [
//  0     1     2     3     4     5     6     7     8     9    10    11
  0.12, 0.08, 0.06, 0.05, 0.08, 0.20, 0.55, 0.82, 0.92, 0.95, 0.90, 0.85,
// 12    13    14    15    16    17    18    19    20    21    22    23
  0.88, 0.85, 0.82, 0.88, 0.92, 0.95, 0.90, 0.75, 0.50, 0.32, 0.22, 0.15,
];

// Multiplicador Semana Santa (45% más tráfico en festivos, especialmente corredores turísticos)
const SS_MULTIPLIER = 1.45;

// Get Colombia hour (America/Bogota UTC-5) regardless of browser timezone
function getColombiaHour() {
  return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }), 10);
}

function getHourlyFactor() {
  const hour = getColombiaHour();
  return HOURLY_FLOW_PROFILE[hour] || 0.5;
}

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
  const hourFactor = getHourlyFactor();
  // Velocidad inversamente proporcional al IRT y a la hora pico
  const speed = clamp(Math.round(90 - irt * 0.55 - hourFactor * 15 + rnd(8)), 15, 110);
  // Flujo proporcional al perfil horario + factor IRT (más congestión = más vehículos intentando pasar)
  const baseFlow = 80 + hourFactor * 480; // 80 en madrugada, 560 en hora pico
  const flow = clamp(Math.round(baseFlow * SS_MULTIPLIER + irt * 1.2 + rnd(20)), 60, 680);
  const occup = clamp(Math.round(irt * 0.65 + hourFactor * 25 + 8 + rnd(4)), 5, 95);
  const c4closed = irt > 82;

  // SEMANA SANTA — fin de semana largo
  // Colas significativas solo en horas pico: 6-8am y 15-17 (3-5pm)
  // Colas moderadas en horario diurno (alta demanda sostenida en festivo)
  // Sin cola en madrugada/noche
  const hour = getColombiaHour();
  const isPeakAM = hour >= 6 && hour <= 8;
  const isPeakPM = hour >= 15 && hour <= 17;
  const isPeak = isPeakAM || isPeakPM;
  const queueFactor = isPeak ? 1.0
    : (hour >= 9 && hour <= 14) ? 0.45   // Semana Santa: más cola durante el día
    : (hour >= 18 && hour <= 20) ? 0.35  // tarde-noche: moderada
    : 0.0;                                // madrugada/noche: sin cola

  const lanes = [
    { id: 1, label: 'C1', type: 'FacilPass', status: 'active', active: true, speed: clamp(Math.round(speed + 8 + rnd(8)), 15, 110), queue: clamp(Math.round(((irt - 30) / 12 + rnd(1.5)) * queueFactor), 0, 8) },
    { id: 2, label: 'C2', type: 'FacilPass', status: 'active', active: true, speed: clamp(Math.round(speed + 12 + rnd(6)), 15, 110), queue: clamp(Math.round(((irt - 35) / 14 + rnd(1.5)) * queueFactor), 0, 8) },
    { id: 3, label: 'C3', type: 'Efectivo', status: 'active', active: true, speed: clamp(Math.round(speed - 5 + rnd(8)), 15, 110), queue: clamp(Math.round(((irt - 25) / 10 + rnd(2)) * queueFactor), 0, 8) },
    { id: 4, label: 'C4', type: 'Efectivo', status: c4closed ? 'closed' : 'active', active: !c4closed, speed: c4closed ? 0 : clamp(Math.round(speed - 8 + rnd(6)), 15, 110), queue: 0 },
  ];

  // Total vehículos acumulados del día, proporcional a la hora actual
  const accumulatedFlow = HOURLY_FLOW_PROFILE.slice(0, hour + 1).reduce((s, f) => s + f * 560, 0);
  const metrics = {
    vehiclesTotal: Math.round(accumulatedFlow * SS_MULTIPLIER + rnd(50)),
    vehiclesHour: flow,
    avgSpeed: speed,
    occupancy: occup,
    irt: Math.round(irt),
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  // Historial inicial: últimas 2h con curva basada en perfil horario real
  const now = new Date();
  const speedHistory = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 5 * 60 * 1000);
    const pastHour = t.getHours();
    const hf = HOURLY_FLOW_PROFILE[pastHour] || 0.5;
    // En horas pico la velocidad baja, en valles sube
    const s = clamp(Math.round(95 - hf * 40 - irt * 0.3 + rnd(8)), 20, 110);
    return {
      time: t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
      avgSpeed: s,
      limit: 80,
      violations: s > 80 ? Math.round(Math.random() * 4) : 0,
    };
  });

  return { lanes, metrics, speedHistory, alerts: [] };
}

function updateHistory(prev, irt) {
  const speed = clamp(Math.round(85 - irt * 0.62 + rnd(10)), 15, 110);
  const now = new Date();
  const point = {
    time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
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
            id: `t-${(++alertIdRef.current) % 100000}-${Date.now().toString(36)}`,
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
