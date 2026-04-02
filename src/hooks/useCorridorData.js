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
// Actualizado 23/mar 17:00h — reporte DITRA campo: tráfico ESTANCADO en Chuzacá
// Pico extendido real 13h-20h, gridlock severo 17h-20h en C3/C4/C5/C6
const CORRIDOR_IRT_PROFILES_RETORNO = {
  C1: [10, 8, 8, 8,10,15,22,30,38,45,50,55,60,65,68,70,72,68,55,38,22,15,12,10],
  C2: [10, 8, 8, 8,10,15,22,30,38,45,50,55,60,65,68,70,68,60,45,30,20,14,10, 8],
  C3: [12,10,10,10,12,18,28,38,48,58,68,78,85,90,95,96,97,95,88,65,35,20,14,10],  // GRIDLOCK 15h-19h (95-97)
  C4: [12,10,10,12,15,20,30,42,55,65,72,78,82,88,90,92,92,88,72,45,25,16,12,10],  // Estancado 15h-18h
  C5: [10, 8, 8,10,12,18,25,35,48,62,75,85,90,95,96,97,95,90,72,42,25,16,12, 8],  // GRIDLOCK 14h-18h
  C6: [10, 8, 8,10,12,18,28,38,50,62,72,80,85,92,95,95,92,85,62,38,22,14,10, 8],  // Estancado 13h-18h
  C7: [12,10,10,10,12,16,25,35,48,58,65,72,78,85,88,88,82,70,50,35,24,18,14,12],  // Alto 14h-17h
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

// ─── Perfiles IRT ÉXODO PLENO (Jueves Santo 2 Abr) ───
// Actualizado con foto campo Chinauta 9:03 AM: COLAPSO TOTAL en salidas Bogotá
// Pico AM extendido 6-11AM, pico PM 13-18PM — congestión sostenida todo el día
const CORRIDOR_IRT_PROFILES_EXODO_PLENO = {
  C1: [15,12,10,10,15,30,55,72,78,75,68,62,58,62,70,75,68,55,42,32,25,20,15,12],
  C2: [12,10,8,8,12,25,45,62,68,65,58,52,48,52,62,68,62,48,35,28,22,15,12,10],
  C3: [18,15,12,12,22,48,82,95,98,95,88,78,72,78,92,98,92,75,52,38,28,22,18,15],  // COLAPSO 7-9AM (foto Chinauta 98), pico PM 92-98
  C4: [20,18,15,15,22,42,68,82,88,85,78,68,62,68,82,88,82,65,48,38,28,22,20,18],  // Túnel saturado
  C5: [22,18,15,15,25,52,82,95,98,95,85,75,68,75,92,98,95,72,48,35,28,22,20,18],  // Llanos: COLAPSO pico AM y PM
  C6: [15,12,10,10,18,35,58,75,82,78,68,60,55,62,75,82,72,55,40,30,24,18,15,12],  // Tunja: turismo religioso alto
  C7: [10,8,8,8,12,22,38,55,62,58,52,48,45,52,62,68,58,42,32,25,20,15,12,10],   // Caribe: turismo playa
};

// ─── Multiplicadores ÉXODO PLENO — Jueves Santo campo confirmado ───
const SS_MULTIPLIERS_EXODO_PLENO = {
  C1: 1.30,
  C2: 1.20,
  C3: 1.65,  // COLAPSO confirmado foto campo Chinauta 9:03 AM
  C4: 1.40,  // Túnel La Línea saturado
  C5: 1.70,  // Bogotá→Villavicencio: récord histórico
  C6: 1.50,  // Bogotá→Tunja: turismo religioso máximo
  C7: 1.25,
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
  const opMode = getOperationMode();
  const { isRetorno } = opMode;
  const isPleno = opMode.exodoLevel === 'pleno';
  // Éxodo pleno: usar perfiles altos TODO EL DÍA (no solo picos puntuales)
  // La foto de campo Chinauta 9:03 AM confirma colapso sostenido desde las 6AM

  let profiles, multipliers;
  if (isPleno) {
    profiles = CORRIDOR_IRT_PROFILES_EXODO_PLENO;
    multipliers = SS_MULTIPLIERS_EXODO_PLENO;
  } else if (isRetorno) {
    profiles = CORRIDOR_IRT_PROFILES_RETORNO;
    multipliers = SS_MULTIPLIERS_RETORNO;
  } else {
    profiles = CORRIDOR_IRT_PROFILES_SALIDA;
    multipliers = SS_MULTIPLIERS_SALIDA;
  }
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
