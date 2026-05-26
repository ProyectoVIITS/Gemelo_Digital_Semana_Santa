/**
 * Hook de datos en tiempo real para los 7 corredores NEXUS.
 *
 * IRT, velocidad y flujo derivados de los datos reales fusionados en
 * el backend (Google Routes + TomTom + Waze TVT). Sin tablas horarias
 * hardcodeadas. Sin random per-tick. Si no hay datos API para los
 * peajes del corredor, asume fluido (IRT bajo).
 *
 * Flow: estimado vía Greenshields a partir de velocidad + congestion.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NEXUS_CORRIDORS, getIRTLevel, HIGH_RISK_TOLLS } from '../data/nexusCorridors';
import { useTrafficStore } from '../store/trafficStore';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Greenshields para flujo a nivel corredor (suma sobre peajes) ───
function estimateFlow(speedKmh, congestionRatio, lanes = 2) {
  const K_JAM = 120;     // veh/km/carril (bumper-to-bumper)
  const K_FREE = 15;     // veh/km/carril (baseline flujo libre)
  const cr = congestionRatio != null ? congestionRatio : 0;
  const kPerLane = cr < 0.2 ? K_FREE : K_JAM * cr;
  return Math.round(kPerLane * (speedKmh || 0) * lanes);
}

// ─── Deriva el IRT del corredor desde sus peajes reales ───
function deriveCorridorIRT(tolls) {
  if (!tolls.length) return 12;  // Sin datos API → fluido
  let maxIrt = 0;
  for (const t of tolls) {
    const cr = t.congestionRatio || 0;
    const wl = t.wazeJamLevel || 0;
    let irt = cr * 80;
    if (wl) irt = Math.max(irt, wl * 15);
    if (t.hasRoadClosure) irt = Math.max(irt, 90);
    else if (t.hasMajorIncident) irt = Math.max(irt, 75);
    if (irt > maxIrt) maxIrt = irt;
  }
  return clamp(Math.round(maxIrt), 0, 100);
}

function deriveTollIRT(traffic) {
  if (!traffic) return 12;
  const cr = traffic.congestionRatio || 0;
  const wl = traffic.wazeJamLevel || 0;
  let irt = cr * 80;
  if (wl) irt = Math.max(irt, wl * 15);
  if (traffic.hasRoadClosure) irt = Math.max(irt, 90);
  else if (traffic.hasMajorIncident) irt = Math.max(irt, 75);
  return clamp(Math.round(irt), 0, 100);
}

function generateTollData(station, trafficData, corridorSpeedLimit) {
  const isHighRisk = HIGH_RISK_TOLLS.includes(station.id);
  const real = trafficData[station.id] || null;
  const irt = deriveTollIRT(real);

  const speedLimit = station.speedLimit || corridorSpeedLimit || 80;
  const speed = real && real.currentSpeed != null
    ? Math.round(real.currentSpeed)
    : Math.round(speedLimit * Math.max(0.4, 1 - irt / 120));

  const cr = real ? real.congestionRatio : 0;
  const flow = estimateFlow(speed, cr, 2);
  const queue = irt > 60 ? Math.round((irt - 60) / 8) : 0;
  const occupancy = real && real.congestionRatio != null
    ? clamp(Math.round(10 + real.congestionRatio * 80), 5, 98)
    : clamp(Math.round(irt * 0.6), 3, 95);

  return {
    stationId: station.id,
    speed,
    flow,
    queue,
    occupancy,
    irt,
    overweightAlert: false, // Calculado en CCTV real, no inventar aquí
    lastVehicleCategory: 'C1',
    isHighRisk,
    timestamp: new Date(),
  };
}

function generateCorridorData(corridor, allTrafficData) {
  // Recolectar datos reales de los peajes del corredor
  const tolls = (corridor.tollStations || [])
    .map(s => allTrafficData[s.id])
    .filter(t => t && t.currentSpeed != null);

  let avgSpeed, flowVph, irt;

  if (tolls.length === 0) {
    // Sin datos reales: asumir fluido honestamente (no inventar congestión)
    avgSpeed = corridor.speedLimit || 80;
    flowVph = estimateFlow(avgSpeed, 0, 2);
    irt = 12;
  } else {
    irt = deriveCorridorIRT(tolls);
    avgSpeed = Math.round(tolls.reduce((s, t) => s + t.currentSpeed, 0) / tolls.length);
    const avgCr = tolls.reduce((s, t) => s + (t.congestionRatio || 0), 0) / tolls.length;
    flowVph = estimateFlow(avgSpeed, avgCr, 2);
  }

  const level = getIRTLevel(irt);

  const tollData = (corridor.tollStations || []).map(s =>
    generateTollData(s, allTrafficData, corridor.speedLimit)
  );

  // Incidentes solo si los peajes reportan datos reales
  const incidentCount = tolls.reduce(
    (s, t) => s + (t.hasMajorIncident ? 1 : 0) + (t.hasRoadClosure ? 1 : 0),
    0,
  );

  return {
    corridorId: corridor.id,
    status: level.label,
    statusColor: level.color,
    avgSpeed,
    irt,
    flowVph,
    incidentCount,
    activeTolls: corridor.tollStations.length,
    totalTolls: corridor.tollStations.length,
    timestamp: new Date(),
    tollData,
  };
}

export function useCorridorData(updateIntervalMs = 2000) {
  const trafficData = useTrafficStore(s => s.trafficData);
  const [corridorData, setCorridorData] = useState({});
  const [irtHistory, setIrtHistory] = useState({});
  const intervalRef = useRef(null);

  const update = useCallback(() => {
    const newData = {};
    NEXUS_CORRIDORS.forEach(corridor => {
      newData[corridor.id] = generateCorridorData(corridor, trafficData || {});
    });

    setCorridorData(newData);

    // Track IRT history (últimos 16 puntos)
    setIrtHistory(prev => {
      const updated = { ...prev };
      NEXUS_CORRIDORS.forEach(c => {
        const history = updated[c.id] || [];
        updated[c.id] = [...history.slice(-15), {
          time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }),
          irt: newData[c.id].irt,
        }];
      });
      return updated;
    });
  }, [trafficData]);

  useEffect(() => {
    update();
    intervalRef.current = setInterval(update, updateIntervalMs);
    return () => clearInterval(intervalRef.current);
  }, [update, updateIntervalMs]);

  // Derived global metrics
  const globalMetrics = {
    totalFlowVph: Object.values(corridorData).reduce((s, d) => s + d.flowVph, 0),
    maxIrt: Math.max(...Object.values(corridorData).map(d => d.irt), 0),
    worstCorridor: Object.values(corridorData).sort((a, b) => b.irt - a.irt)[0],
    totalIncidents: Object.values(corridorData).reduce((s, d) => s + d.incidentCount, 0),
    activeCorridors: Object.keys(corridorData).length,
    totalTolls: NEXUS_CORRIDORS.reduce((s, c) => s + c.tollStations.length, 0),
  };

  return { corridorData, irtHistory, globalMetrics };
}
