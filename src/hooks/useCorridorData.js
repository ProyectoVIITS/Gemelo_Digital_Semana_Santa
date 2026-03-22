/**
 * Hook de datos en tiempo real para los 7 corredores NEXUS
 * Simula feed de sensores VIITS — en producción conectará a la API
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NEXUS_CORRIDORS, computeIRT, getIRTLevel, HIGH_RISK_TOLLS } from '../data/nexusCorridors';

// Perfiles IRT base por hora del día para cada corredor
const CORRIDOR_IRT_PROFILES = {
  C1: [15,12,10,10,12,18,30,42,50,55,52,48,45,48,52,55,50,42,35,28,22,18,15,12],
  C2: [12,10,8,8,10,15,25,35,42,48,50,48,45,42,45,48,45,38,30,25,20,15,12,10],
  C3: [18,15,12,12,15,25,45,62,72,75,68,60,55,58,65,70,65,55,42,32,25,20,18,15],
  C4: [20,18,15,15,18,28,48,58,65,68,65,60,55,58,62,65,62,55,45,35,28,22,20,18],
  C5: [22,18,15,15,20,35,55,72,82,85,78,68,60,55,58,62,58,48,38,30,25,22,20,18],
  C6: [15,12,10,10,12,22,38,52,60,62,58,52,48,50,55,58,55,45,35,28,22,18,15,12],
  C7: [10,8,8,8,10,15,22,32,42,48,52,55,52,48,45,42,38,32,28,22,18,15,12,10],
};

// Semana Santa multiplier: corredores de descanso tienen IRT más alto
const SS_MULTIPLIERS = {
  C1: 1.15,
  C2: 1.05,
  C3: 1.35, // Bogotá-Girardot: corredor de descanso
  C4: 1.20, // Túnel La Línea
  C5: 1.40, // Bogotá-Villavicencio: corredor de descanso
  C6: 1.30, // Bogotá-Tunja: corredor de descanso
  C7: 1.10,
};

function generateTollData(station, corridorSpeedLimit, corridorIrt) {
  const isHighRisk = HIGH_RISK_TOLLS.includes(station.id);
  const isCritical = station.isCritical;
  const riskBoost = isHighRisk ? 8 : isCritical ? 12 : 0;

  const baseIrt = corridorIrt + riskBoost + (Math.random() * 10 - 5);
  const irt = Math.max(0, Math.min(100, baseIrt));

  const speedLimit = station.speedLimit || corridorSpeedLimit;
  const speed = Math.max(15, speedLimit * (1 - irt / 120) + (Math.random() * 8 - 4));
  const flow = Math.round(80 + (irt / 100) * 520 + Math.random() * 40);
  const queue = irt > 60 ? Math.round((irt - 60) / 8 + Math.random() * 3) : Math.round(Math.random() * 2);
  const occupancy = Math.min(100, Math.round(irt * 0.85 + Math.random() * 10));

  const categories = ['C1', 'C2', 'C3', 'C4', 'C5'];
  const lastCategory = categories[Math.floor(Math.random() * 3)]; // C1 most common

  return {
    stationId: station.id,
    speed: Math.round(speed),
    flow,
    queue,
    occupancy,
    irt: Math.round(irt),
    overweightAlert: Math.random() < 0.02,
    lastVehicleCategory: lastCategory,
    timestamp: new Date(),
  };
}

function generateCorridorData(corridor, hour) {
  const baseIrt = CORRIDOR_IRT_PROFILES[corridor.id]?.[hour] || 40;
  const ssMultiplier = SS_MULTIPLIERS[corridor.id] || 1.0;
  const irt = Math.max(0, Math.min(100,
    baseIrt * ssMultiplier + (Math.random() * 8 - 4)
  ));

  const speed = Math.max(15, corridor.speedLimit * (1 - irt / 120) + (Math.random() * 6 - 3));
  const flow = Math.round(150 + (irt / 100) * 450 + Math.random() * 30);
  const level = getIRTLevel(irt);

  const tollData = corridor.tollStations.map(s =>
    generateTollData(s, corridor.speedLimit, irt)
  );

  const incidentCount = irt > 75
    ? Math.floor(Math.random() * 3) + 1
    : irt > 50 ? (Math.random() < 0.3 ? 1 : 0) : 0;

  return {
    corridorId: corridor.id,
    status: level.label,
    statusColor: level.color,
    avgSpeed: Math.round(speed),
    irt: Math.round(irt),
    flowVph: flow,
    incidentCount,
    activeTolls: corridor.tollStations.length,
    totalTolls: corridor.tollStations.length,
    timestamp: new Date(),
    tollData,
  };
}

export function useCorridorData(updateIntervalMs = 2000) {
  const [corridorData, setCorridorData] = useState({});
  const [irtHistory, setIrtHistory] = useState({});
  const intervalRef = useRef(null);

  const update = useCallback(() => {
    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }), 10);
    const newData = {};

    NEXUS_CORRIDORS.forEach(corridor => {
      newData[corridor.id] = generateCorridorData(corridor, hour);
    });

    setCorridorData(newData);

    // Track IRT history (last 16 data points = ~32 seconds of visual history)
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
  }, []);

  useEffect(() => {
    update(); // Initial data
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
