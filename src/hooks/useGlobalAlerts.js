/**
 * Hook de alertas globales para los 7 corredores NEXUS
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NEXUS_CORRIDORS, HIGH_RISK_TOLLS, CORRIDOR_COLORS } from '../data/nexusCorridors';

const ALERT_MESSAGES = {
  speed: [
    'Velocidad por debajo del umbral operacional',
    'Reducción significativa de velocidad detectada',
    'Velocidad crítica — posible bloqueo parcial',
  ],
  congestion: [
    'Congestión creciente detectada en el tramo',
    'Nivel de saturación elevado — cola en aumento',
    'CONGESTIÓN SEVERA — activar plan de contingencia',
  ],
  incident: [
    'Incidente reportado en la vía',
    'Accidente vehicular — carril reducido',
    'EMERGENCIA — vía parcialmente cerrada',
  ],
  weather: [
    'Lluvia moderada en el tramo — precaución',
    'Lluvia intensa — visibilidad reducida',
    'ALERTA METEOROLÓGICA — riesgo de deslizamiento',
  ],
  overweight: [
    'Vehículo con exceso de peso detectado',
  ],
  capacity: [
    'Capacidad vial superada — flujo saturado',
  ],
};

const SEVERITIES = ['info', 'warning', 'critical', 'emergency'];

let alertIdCounter = 0;

function generateAlert(corridorData) {
  if (!corridorData || Object.keys(corridorData).length === 0) return null;

  const corridors = Object.values(corridorData);
  const corridor = corridors[Math.floor(Math.random() * corridors.length)];
  const nexusCorridor = NEXUS_CORRIDORS.find(c => c.id === corridor.corridorId);
  if (!nexusCorridor) return null;

  // Pick a random toll from this corridor
  const toll = nexusCorridor.tollStations[
    Math.floor(Math.random() * nexusCorridor.tollStations.length)
  ];

  const isHighRisk = HIGH_RISK_TOLLS.includes(toll.id);
  const isCritical = toll.isCritical;

  // Higher probability for high-risk and critical tolls
  const baseProbability = 0.015;
  const probability = baseProbability
    * (isHighRisk ? 4 : 1)
    * (isCritical ? 3 : 1)
    * (corridor.irt > 70 ? 2 : 1);

  if (Math.random() > probability) return null;

  // Determine alert type based on corridor state
  let type, severity, messages;
  if (corridor.irt > 85) {
    type = Math.random() < 0.5 ? 'congestion' : 'incident';
    severity = Math.random() < 0.3 ? 'emergency' : 'critical';
  } else if (corridor.irt > 65) {
    type = Math.random() < 0.6 ? 'congestion' : (Math.random() < 0.5 ? 'speed' : 'weather');
    severity = Math.random() < 0.4 ? 'critical' : 'warning';
  } else if (corridor.irt > 40) {
    type = Math.random() < 0.5 ? 'speed' : 'weather';
    severity = 'warning';
  } else {
    type = Math.random() < 0.7 ? 'speed' : 'overweight';
    severity = 'info';
  }

  messages = ALERT_MESSAGES[type] || ALERT_MESSAGES.speed;
  const severityIdx = SEVERITIES.indexOf(severity);
  const messageIdx = Math.min(severityIdx, messages.length - 1);

  return {
    id: `alert-${++alertIdCounter}`,
    corridorId: corridor.corridorId,
    corridorName: nexusCorridor.shortName,
    corridorColor: CORRIDOR_COLORS[corridor.corridorId],
    stationId: toll.id,
    stationName: toll.name,
    stationKm: toll.km,
    type,
    severity,
    message: messages[messageIdx],
    irt: corridor.irt,
    speed: corridor.avgSpeed,
    timestamp: new Date(),
  };
}

export function useGlobalAlerts(corridorData, maxAlerts = 20) {
  const [alerts, setAlerts] = useState([]);
  const intervalRef = useRef(null);

  const tick = useCallback(() => {
    const newAlert = generateAlert(corridorData);
    if (newAlert) {
      setAlerts(prev => [newAlert, ...prev].slice(0, maxAlerts));
    }
  }, [corridorData, maxAlerts]);

  useEffect(() => {
    intervalRef.current = setInterval(tick, 2000);
    return () => clearInterval(intervalRef.current);
  }, [tick]);

  const alertsByCorridor = (corridorId) =>
    alerts.filter(a => a.corridorId === corridorId);

  const criticalAlerts = alerts.filter(a =>
    a.severity === 'critical' || a.severity === 'emergency'
  );

  return { alerts, alertsByCorridor, criticalAlerts };
}
