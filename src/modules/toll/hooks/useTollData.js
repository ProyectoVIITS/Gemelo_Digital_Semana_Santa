import { useState, useEffect, useRef } from 'react';
import { HIGH_RISK_TOLLS, ALL_TOLL_STATIONS } from '../../../data/nexusCorridors';
import { getOperationMode, getColombiaHour } from '../../../utils/operationMode';

// ─── Lookup booth config from toll station data ───
function getBoothConfig(stationId) {
  const toll = ALL_TOLL_STATIONS.find(t => t.id === stationId);
  return toll?.boothConfig || { total: 4, salida: 3, retorno: 1 };
}

// ─── Base IRT por peaje — SALIDA (tráfico alejándose de Bogotá) ───
const BASE_IRT = {
  'C1-07': 58, 'C1-08': 45,
  'C2-03': 42,
  'C3-01': 55, 'C3-02': 60,
  'C4-02': 52, 'C4-03': 52,
  'C5-02': 58,
  'C6-02': 48,
  'C7-03': 38,
};

// ─── Base IRT por peaje — RETORNO (tráfico hacia Bogotá) ───
// Los peajes cercanos a Bogotá se congestionan; los lejanos fluyen mejor
const BASE_IRT_RETORNO = {
  'C1-07': 48, 'C1-08': 62,    // Siberia: entrada occidental a Bogotá
  'C2-03': 42,
  'C3-01': 82, 'C3-02': 72,    // Chuzacá + Chinauta: embudos críticos → Bogotá
  'C3-03': 45, 'C3-04': 40,    // Pubenza + Flandes: inicio retorno, fluido
  'C4-02': 48, 'C4-03': 50,
  'C5-01': 72, 'C5-02': 68,    // Naranjal + Cáqueza: entrada Llanos → Bogotá
  'C6-01': 68, 'C6-02': 55,    // Albarracín + Tuta: entrada Boyacá → Bogotá
  'C7-03': 38,
};

// ─── Perfil horario SALIDA (Semana Santa — fin de semana largo) ───
const HOURLY_FLOW_PROFILE_SALIDA = [
//  0     1     2     3     4     5     6     7     8     9    10    11
  0.12, 0.08, 0.06, 0.05, 0.08, 0.20, 0.55, 0.82, 0.92, 0.95, 0.90, 0.85,
// 12    13    14    15    16    17    18    19    20    21    22    23
  0.88, 0.85, 0.82, 0.88, 0.92, 0.95, 0.90, 0.75, 0.50, 0.32, 0.22, 0.15,
];

// ─── Perfil horario RETORNO (lunes festivo — regreso a ciudades) ───
// Patrón real: madrugada tranquila, acumulación desde 10am, pico masivo 1pm-5pm
// Fuente: patrones INVÍAS Operación Retorno festivos Colombia
const HOURLY_FLOW_PROFILE_RETORNO = [
//  0     1     2     3     4     5     6     7     8     9    10    11
  0.06, 0.05, 0.04, 0.04, 0.06, 0.10, 0.20, 0.35, 0.50, 0.65, 0.78, 0.85,
// 12    13    14    15    16    17    18    19    20    21    22    23
  0.90, 0.95, 0.98, 1.00, 0.95, 0.88, 0.75, 0.58, 0.38, 0.22, 0.12, 0.08,
];

// Multiplicadores Semana Santa
const SS_MULTIPLIER_SALIDA = 1.45;
const SS_MULTIPLIER_RETORNO = 1.50; // Retorno más concentrado en pocas horas

function getHourlyFactor() {
  const hour = getColombiaHour();
  const { isRetorno } = getOperationMode();
  const profile = isRetorno ? HOURLY_FLOW_PROFILE_RETORNO : HOURLY_FLOW_PROFILE_SALIDA;
  return profile[hour] || 0.5;
}

function getActiveProfile() {
  const { isRetorno } = getOperationMode();
  return {
    flowProfile: isRetorno ? HOURLY_FLOW_PROFILE_RETORNO : HOURLY_FLOW_PROFILE_SALIDA,
    ssMultiplier: isRetorno ? SS_MULTIPLIER_RETORNO : SS_MULTIPLIER_SALIDA,
    baseIrtMap: isRetorno ? BASE_IRT_RETORNO : BASE_IRT,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (range) => (Math.random() - 0.5) * range;

function generateAlertMessage(irt, isRetorno) {
  const retornoMsgs = irt > 70
    ? [
        'Cola retorno > 10 veh detectada',
        'Velocidad media < 30 km/h sentido Bogotá',
        'Congestión severa en casetas de retorno',
        'Vehículo averiado en calzada sentido capital',
      ]
    : [
        `Cola moderada retorno: ${3 + Math.round(Math.random() * 4)} veh`,
        'Flujo retorno aumentando: +22%',
        'Casetas retorno operando al 85%',
      ];

  const salidaMsgs = irt > 70
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

  const msgs = isRetorno ? retornoMsgs : salidaMsgs;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function buildSnapshot(irt, stationId) {
  const { isRetorno } = getOperationMode();
  const { flowProfile, ssMultiplier } = getActiveProfile();
  const hourFactor = getHourlyFactor();
  const hour = getColombiaHour();

  const speed = clamp(Math.round(90 - irt * 0.55 - hourFactor * 15 + rnd(8)), 15, 110);
  const baseFlow = 80 + hourFactor * 480;
  const flow = clamp(Math.round(baseFlow * ssMultiplier + irt * 1.2 + rnd(20)), 60, 680);
  const occup = clamp(Math.round(irt * 0.65 + hourFactor * 25 + 8 + rnd(4)), 5, 95);
  const c4closed = irt > 82;

  // ─── Colas: patrón diferente para SALIDA vs RETORNO ───
  let queueFactor;
  if (isRetorno) {
    // RETORNO: pico masivo 1pm-5pm, acumulación desde 10am
    const isPeakReturn = hour >= 13 && hour <= 17;
    const isBuildUp = hour >= 10 && hour <= 12;
    const isEvening = hour >= 18 && hour <= 20;
    queueFactor = isPeakReturn ? 1.0
      : isBuildUp ? 0.65
      : isEvening ? 0.45
      : 0.0;
  } else {
    // SALIDA: picos 6-8am y 3-5pm (sin cambios)
    const isPeakAM = hour >= 6 && hour <= 8;
    const isPeakPM = hour >= 15 && hour <= 17;
    const isPeak = isPeakAM || isPeakPM;
    queueFactor = isPeak ? 1.0
      : (hour >= 9 && hour <= 14) ? 0.45
      : (hour >= 18 && hour <= 20) ? 0.35
      : 0.0;
  }

  // ─── Generar N carriles dinámicos basados en boothConfig real ───
  // Layout físico: C1 y C2 son SIEMPRE casetas de retorno (entrada a Bogotá)
  // C3 en adelante son casetas de salida (salida de Bogotá)
  // En modo SALIDA: C1 (y C2 si retorno > 1) cerrados, resto activos
  // En modo RETORNO: C1 (y C2) activos, la mayoría del resto cerrados
  const booth = getBoothConfig(stationId);
  const totalLaneCount = booth.total;
  const retornoBooths = booth.retorno; // cuántas casetas son de retorno (siempre las primeras)

  const lanes = [];
  for (let i = 0; i < totalLaneCount; i++) {
    const isRetornoBooth = i < retornoBooths; // C1, C2... son casetas de retorno
    const isActive = isRetorno ? isRetornoBooth : !isRetornoBooth;

    // En retorno, también activar algunas casetas de salida si hay muchas
    // (INVÍAS puede habilitar casetas adicionales en festivos)
    const isExtraActive = isRetorno && !isRetornoBooth && i < retornoBooths + Math.floor((totalLaneCount - retornoBooths) * 0.6);
    const finalActive = isActive || isExtraActive;

    const activeLaneIndex = finalActive ? lanes.filter(l => l.active).length : -1;
    const isFacilPass = finalActive && activeLaneIndex < Math.ceil(booth.total * 0.25);
    const laneSpeed = finalActive
      ? clamp(Math.round(speed + (isFacilPass ? 10 : -3) + rnd(8)), 15, 110)
      : 0;
    const laneQueue = finalActive
      ? clamp(Math.round(((irt - 28) / (10 + i) + rnd(1.5)) * queueFactor), 0, 8)
      : 0;

    lanes.push({
      id: i + 1,
      label: `C${i + 1}`,
      type: isFacilPass ? 'FacilPass' : 'Efectivo',
      status: finalActive ? 'active' : 'closed',
      active: finalActive,
      speed: laneSpeed,
      queue: laneQueue,
    });
  }

  const accumulatedFlow = flowProfile.slice(0, hour + 1).reduce((s, f) => s + f * 560, 0);
  const metrics = {
    vehiclesTotal: Math.round(accumulatedFlow * ssMultiplier + rnd(50)),
    vehiclesHour: flow,
    avgSpeed: speed,
    occupancy: occup,
    irt: Math.round(irt),
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  const now = new Date();
  const speedHistory = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 5 * 60 * 1000);
    const pastHour = t.getHours();
    const hf = flowProfile[pastHour] || 0.5;
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
  const { baseIrtMap } = getActiveProfile();
  const baseIRT = baseIrtMap[stationId] ?? 40;
  const isHighRisk = HIGH_RISK_TOLLS.includes(stationId);
  const { isRetorno } = getOperationMode();

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
            message: generateAlertMessage(irt, isRetorno),
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
  }, [baseIRT, stationId, isHighRisk, isRetorno]);

  return data;
}
