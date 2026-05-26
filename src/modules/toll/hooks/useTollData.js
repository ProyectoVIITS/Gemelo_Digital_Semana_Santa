import { useState, useEffect, useRef } from 'react';
import { HIGH_RISK_TOLLS, ALL_TOLL_STATIONS } from '../../../data/nexusCorridors';
import { getOperationMode, getColombiaHour, getActiveBooths } from '../../../utils/operationMode';

// ─── Lookup booth config from toll station data ───
function getBoothConfig(stationId) {
  const toll = ALL_TOLL_STATIONS.find(t => t.id === stationId);
  return toll?.boothConfig || { total: 4, salida: 3, retorno: 1 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (range) => (Math.random() - 0.5) * range;

// ─── Deriva el IRT del peaje desde los datos reales (Google + Waze) ───
// Sin datos = vía fluida (IRT bajo). Antes había tablas BASE_IRT hardcodeadas
// que inflaban congestión inexistente en cada estación.
function deriveTollIRT(realTraffic) {
  if (!realTraffic) return 12;
  const cr = realTraffic.congestionRatio;
  const wl = realTraffic.wazeJamLevel || 0;
  let irt = (cr != null ? cr : 0) * 80;
  if (wl) irt = Math.max(irt, wl * 15);
  if (realTraffic.hasRoadClosure) irt = Math.max(irt, 90);
  else if (realTraffic.hasMajorIncident) irt = Math.max(irt, 75);
  return clamp(Math.round(irt), 0, 100);
}

// ─── Greenshields: Q = K × V ───
// En régimen libre asumimos K baseline (~15 veh/km/carril, tráfico normal
// autopista). En congestión usamos K_jam × congestionRatio.
function estimateFlow(speedKmh, congestionRatio, lanes = 2) {
  const K_JAM = 120;       // veh/km/carril, bumper-to-bumper
  const K_FREE = 15;       // veh/km/carril, baseline flujo libre normal
  const cr = congestionRatio != null ? congestionRatio : 0;
  const kPerLane = cr < 0.2 ? K_FREE : K_JAM * cr;
  return Math.round(kPerLane * (speedKmh || 0) * lanes);
}

function generateAlertMessage(irt, isRetorno) {
  const criticalMsgs = isRetorno
    ? [
        'Cola retorno > 10 veh en caseta principal',
        'Velocidad media < 25 km/h sentido Bogotá',
        'Congestión severa — casetas retorno al 95%',
        'Vehículo detenido en calzada — carril parcialmente bloqueado',
      ]
    : [
        'Cola > 8 vehículos en caseta de efectivo',
        'Velocidad promedio < 20 km/h — congestión alta',
        'Incidente menor reportado por CCTV en zona de aproximación',
        'Vehículo pesado detenido en caseta — revisión de carga',
      ];

  const warningMsgs = isRetorno
    ? [
        `Cola moderada retorno: ${3 + Math.round(Math.random() * 4)} vehículos`,
        'Casetas retorno operando al 85% de capacidad',
        `Vehículo categoría C5 en revisión — ${Math.round(30 + Math.random() * 8)}t detectadas`,
      ]
    : [
        `Cola en formación: ${3 + Math.round(Math.random() * 3)} vehículos en caseta efectivo`,
        `Vehículo sobrepeso detectado: ${(30 + Math.random() * 14).toFixed(1)}t (límite: 32t)`,
        'Casetas operando al 80% de capacidad — monitoreo activo',
      ];

  const msgs = irt > 70 ? criticalMsgs : warningMsgs;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function buildSnapshot(irt, stationId, realTraffic = null) {
  const opSnap = getOperationMode();
  const { isRetorno } = opSnap;

  // ─── Velocidad: dato REAL de API cuando disponible ──
  let speed;
  if (realTraffic && realTraffic.currentSpeed != null) {
    speed = clamp(Math.round(realTraffic.currentSpeed + rnd(2)), 5, 120);
  } else {
    // Sin datos: asumir flujo libre típico autopista
    speed = clamp(Math.round(70 - irt * 0.4 + rnd(6)), 25, 90);
  }

  // ─── Ocupación derivada del IRT real ───
  let occup;
  if (realTraffic && realTraffic.congestionRatio != null) {
    occup = clamp(Math.round(10 + realTraffic.congestionRatio * 80 + rnd(4)), 5, 98);
  } else {
    // Sin datos: ocupación baja-moderada según IRT derivado (que será bajo)
    occup = clamp(Math.round(irt * 0.6 + rnd(4)), 3, 95);
  }
  const c4closed = irt > 82;

  // ─── Flujo: Greenshields desde velocidad + congestion real ───
  // Reemplaza el cálculo anterior que multiplicaba IRT inventado por random.
  const cinematiqFlow = clamp(
    estimateFlow(speed, realTraffic ? realTraffic.congestionRatio : 0, 2),
    6,
    4800,
  );

  // ── Baseline para inicializar contador monótono de vehículos hoy ──
  // Estimación rough basada en flujo actual × hora del día. No se renderiza
  // directamente; solo siembra el contador que crece linealmente.
  const hour = getColombiaHour();
  const baselineFlowAprox = cinematiqFlow * (hour + 1);

  // ─── Cola: derivada de congestion real ───
  const queueFactor = realTraffic && realTraffic.congestionRatio != null
    ? realTraffic.congestionRatio
    : 0;

  // ─── Generar N carriles dinámicos basados en boothConfig real ───
  const booth = getBoothConfig(stationId);
  const totalLaneCount = booth.total;
  const { retornoActivas } = getActiveBooths(booth);

  const lanes = [];
  let retornoUsed = 0;
  let extraRetornoUsed = 0;
  const extrasNeeded = Math.max(0, retornoActivas - booth.retorno);

  for (let i = 0; i < totalLaneCount; i++) {
    const isRetornoBooth = i < booth.retorno;
    let finalActive;
    let laneDirection;
    const opMode = getOperationMode();
    const isBidirectional = opMode.isBidirectional || false;

    if (isRetorno) {
      if (isRetornoBooth) {
        finalActive = retornoUsed < retornoActivas;
        laneDirection = 'retorno';
        retornoUsed++;
      } else if (extraRetornoUsed < extrasNeeded) {
        finalActive = true;
        laneDirection = 'retorno-extra';
        extraRetornoUsed++;
      } else {
        finalActive = true;
        laneDirection = 'salida';
      }
    } else if (opMode.isExodo) {
      finalActive = true;
      if (retornoUsed < retornoActivas) {
        laneDirection = 'retorno';
        retornoUsed++;
      } else {
        laneDirection = 'salida';
      }
    } else if (isBidirectional) {
      finalActive = true;
      if (retornoUsed < retornoActivas) {
        laneDirection = 'retorno';
        retornoUsed++;
      } else {
        laneDirection = 'salida';
      }
    } else {
      finalActive = true;
      laneDirection = 'salida';
    }

    const activeLaneIndex = finalActive ? lanes.filter(l => l.active).length : -1;
    const isFacilPass = finalActive && activeLaneIndex < Math.ceil(booth.total * 0.25);
    const isRetLane = laneDirection === 'retorno' || laneDirection === 'retorno-extra';

    const laneVariation = ((i * 7 + 3) % 5) - 2;
    let laneSpeed, laneQueue;

    if (!finalActive) {
      laneSpeed = 0;
      laneQueue = 0;
    } else if (isRetLane) {
      const realCong = realTraffic?.congestionRatio || 0;
      const retBaseSpeed = clamp(Math.round(speed * 0.90 + (isFacilPass ? 5 : -2) + laneVariation), 5, 80);
      const retQueue = clamp(Math.round(realCong * 12 * queueFactor + laneVariation * 0.5), 0, 18);
      laneSpeed = retBaseSpeed;
      laneQueue = retQueue;
    } else {
      const realCong = realTraffic?.congestionRatio || 0;
      laneSpeed = clamp(Math.round(speed + (isFacilPass ? 8 : -2) + laneVariation), 5, 80);
      laneQueue = clamp(Math.round(realCong * 8 * queueFactor + laneVariation * 0.3), 0, 10);
    }

    lanes.push({
      id: i + 1,
      label: `C${i + 1}`,
      type: isFacilPass ? 'FacilPass' : 'Efectivo',
      status: finalActive ? 'active' : 'closed',
      active: finalActive,
      speed: laneSpeed,
      queue: laneQueue,
      direction: laneDirection,
    });
  }

  const metrics = {
    vehiclesTotalBaseline: baselineFlowAprox,
    vehiclesHour: cinematiqFlow,
    avgSpeed: speed,
    occupancy: occup,
    irt: Math.round(irt),
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  const now = new Date();
  // Speed history basada en velocidad real actual como referencia
  const speedHistory = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 5 * 60 * 1000);
    const baseHistSpeed = speed || 60;
    const s = clamp(Math.round(baseHistSpeed + rnd(8)), 10, 110);
    return {
      time: t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
      avgSpeed: s,
      limit: 80,
      violations: s > 80 ? Math.round(Math.random() * 4) : 0,
    };
  });

  return { lanes, metrics, speedHistory, alerts: [] };
}

function updateHistory(prev, irt, realSpeed) {
  const speed = realSpeed || clamp(Math.round(70 - irt * 0.35 + rnd(8)), 15, 110);
  const now = new Date();
  const point = {
    time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
    avgSpeed: speed,
    limit: 80,
    violations: speed > 80 ? Math.round(Math.random() * 4) : 0,
  };
  return [...prev.slice(-23), point];
}

/**
 * @param {string} stationId
 * @param {string} corridorId
 * @param {object|null} realTraffic - Datos fusionados Google/TomTom/Waze
 *   { currentSpeed, freeFlowSpeed, congestionRatio, wazeJamLevel, hasRoadClosure, hasMajorIncident, ... }
 */
export default function useTollData(stationId, corridorId, realTraffic = null) {
  const opModeInit = getOperationMode();
  // IRT derivado 100% de datos reales — sin BASE_IRT hardcodeado por peaje
  // ni boost horario inventado. Vías sin datos → IRT bajo (honesto).
  const baseIRT = deriveTollIRT(realTraffic);
  const isHighRisk = HIGH_RISK_TOLLS.includes(stationId);
  const { isRetorno } = opModeInit;

  const [data, setData] = useState(() => buildSnapshot(baseIRT, stationId, realTraffic));
  const alertIdRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      // IRT siempre derivado de los datos reales actuales. Si no hay datos,
      // queda bajo y estable — sin jitter inventado que hacía parecer
      // congestión donde no hay.
      const irt = deriveTollIRT(realTraffic);

      setData(prev => {
        const newAlerts = [];
        const hour = getColombiaHour();
        const isPeakAM = hour >= 6 && hour <= 9;
        const isPeakPM = hour >= 14 && hour <= 18;
        const isPeak = isPeakAM || isPeakPM;

        // Alertas solo cuando hay congestión real (IRT alto = respaldado por datos)
        if (isPeak && irt > 45) {
          const alertProb = irt > 70 ? (isHighRisk ? 0.04 : 0.02) : (isHighRisk ? 0.015 : 0.008);
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
        }

        const snapshot = buildSnapshot(irt, stationId, realTraffic);

        let initialTotal = prev.metrics?.vehiclesTotal;
        if (!initialTotal) {
          initialTotal = Math.round(snapshot.metrics.vehiclesTotalBaseline);
        }
        // Acumulador monótono: si flujo X veh/h, en 1.8 seg pasan ~X/2000 veh
        const secondsPassed = 1.8;
        const incrementalVehicles = (snapshot.metrics.vehiclesHour / 3600) * secondsPassed;
        const newTotal = initialTotal + incrementalVehicles;
        snapshot.metrics.vehiclesTotal = newTotal;

        return {
          ...snapshot,
          metrics: {
            ...snapshot.metrics,
            vehiclesTotalDisplay: Math.floor(newTotal),
            vehiclesTotal: newTotal,
          },
          speedHistory: updateHistory(prev.speedHistory, irt, realTraffic?.currentSpeed),
          alerts: [...newAlerts, ...prev.alerts].slice(0, 8),
        };
      });
    }, 1800);

    return () => clearInterval(id);
  }, [baseIRT, stationId, isHighRisk, isRetorno, realTraffic]); // eslint-disable-line

  return data;
}
