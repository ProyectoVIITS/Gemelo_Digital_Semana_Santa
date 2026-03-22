/**
 * Hook de datos en tiempo real para los 7 corredores NEXUS
 * Simula feed de sensores VIITS — en producción conectará a la API
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NEXUS_CORRIDORS, computeIRT, getIRTLevel, HIGH_RISK_TOLLS } from '../data/nexusCorridors';
import { getOperationMode, getColombiaHour } from '../utils/operationMode';

// ─── Perfiles IRT SALIDA: tráfico alejándose de Bogotá ───
const CORRIDOR_IRT_PROFILES_SALIDA = {
  C1: [15,12,10,10,12,18,30,42,50,55,52,48,45,48,52,55,50,42,35,28,22,18,15,12],
  C2: [12,10,8,8,10,15,25,35,42,48,50,48,45,42,45,48,45,38,30,25,20,15,12,10],
  C3: [18,15,12,12,15,25,45,62,72,75,68,60,55,58,65,70,65,55,42,32,25,20,18,15],
  C4: [20,18,15,15,18,28,48,58,65,68,65,60,55,58,62,65,62,55,45,35,28,22,20,18],
  C5: [22,18,15,15,20,35,55,72,82,85,78,68,60,55,58,62,58,48,38,30,25,22,20,18],
  C6: [15,12,10,10,12,22,38,52,60,62,58,52,48,50,55,58,55,45,35,28,22,18,15,12],
  C7: [10,8,8,8,10,15,22,32,42,48,52,55,52,48,45,42,38,32,28,22,18,15,12,10],
};

// ─── Perfiles IRT RETORNO: tráfico regresando a Bogotá ───
// Pico masivo 12pm–5pm en corredores C3/C5/C6 (destinos vacacionales → capital)
// Madrugada tranquila, acumulación desde 10am
const CORRIDOR_IRT_PROFILES_RETORNO = {
  C1: [10, 8, 8, 8,10,15,22,30,38,45,50,55,60,65,68,65,58,48,35,25,18,15,12,10],
  C2: [10, 8, 8, 8,10,15,22,30,38,45,50,55,60,65,68,65,55,42,30,22,16,12,10, 8],
  C3: [12,10,10,10,12,18,28,38,48,58,68,78,85,90,95,92,85,72,55,38,25,18,12,10],  // Pico 95 a las 2pm
  C4: [12,10,10,12,15,20,30,42,55,65,72,78,82,85,82,75,65,50,35,25,18,14,12,10],
  C5: [10, 8, 8,10,12,18,25,35,48,62,75,85,90,95,92,88,78,62,42,28,20,15,12, 8],  // Pico 95 a las 1-2pm
  C6: [10, 8, 8,10,12,18,28,38,50,62,72,80,85,90,88,82,72,58,40,28,20,14,10, 8],  // Pico 90 a la 1pm
  C7: [12,10,10,10,12,16,25,35,48,58,65,72,78,82,80,75,68,55,40,30,22,16,14,12],
};

// ─── Multiplicadores SALIDA ───
const SS_MULTIPLIERS_SALIDA = {
  C1: 1.15,
  C2: 1.05,
  C3: 1.35,
  C4: 1.20,
  C5: 1.40,
  C6: 1.30,
  C7: 1.10,
};

// ─── Multiplicadores RETORNO (más concentrado en pocas horas) ───
const SS_MULTIPLIERS_RETORNO = {
  C1: 1.10,
  C2: 1.05,
  C3: 1.45,  // Girardot→Bogotá: presión máxima
  C4: 1.15,
  C5: 1.50,  // Villavicencio→Bogotá: masivo
  C6: 1.35,  // Tunja→Bogotá: turismo religioso
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
  const { isRetorno } = getOperationMode();
  const profiles = isRetorno ? CORRIDOR_IRT_PROFILES_RETORNO : CORRIDOR_IRT_PROFILES_SALIDA;
  const multipliers = isRetorno ? SS_MULTIPLIERS_RETORNO : SS_MULTIPLIERS_SALIDA;
  const baseIrt = profiles[corridor.id]?.[hour] || 40;
  const ssMultiplier = multipliers[corridor.id] || 1.0;
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
    const hour = getColombiaHour();
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
