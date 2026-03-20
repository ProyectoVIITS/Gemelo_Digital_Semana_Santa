import { useState, useEffect, useRef } from 'react';

let alertIdCounter = 0;
function nextId() {
  alertIdCounter += 1;
  return `alert-${alertIdCounter}-${Date.now()}`;
}

export default function useAlerts(sensorData) {
  const [alerts, setAlerts] = useState([]);
  const prevRef = useRef(null);

  useEffect(() => {
    if (!sensorData) return;
    const { lanes, flow } = sensorData;
    const newAlerts = [];

    // Lane incident alerts
    lanes.forEach(lane => {
      if (lane.status === 'incident') {
        const prev = prevRef.current?.lanes?.find(l => l.id === lane.id);
        if (!prev || prev.status !== 'incident') {
          newAlerts.push({
            id: nextId(),
            severity: 'warning',
            message: `Incidente detectado en carril ${lane.label} (${lane.type})`,
            lane: lane.id,
            timestamp: new Date(),
            resolved: false,
            source: 'CCTV',
          });
        }
      }
    });

    // Queue threshold
    lanes.forEach(lane => {
      if (lane.queue >= 8) {
        const prev = prevRef.current?.lanes?.find(l => l.id === lane.id);
        if (!prev || prev.queue < 8) {
          newAlerts.push({
            id: nextId(),
            severity: 'warning',
            message: `Cola crítica en carril ${lane.label}: ${lane.queue} vehículos`,
            lane: lane.id,
            timestamp: new Date(),
            resolved: false,
            source: 'CONTEO',
          });
        }
      }
    });

    // Speed violation
    if (flow.avgSpeed > 95) {
      const prevSpeed = prevRef.current?.flow?.avgSpeed || 0;
      if (prevSpeed <= 95) {
        newAlerts.push({
          id: nextId(),
          severity: 'info',
          message: `Velocidad promedio elevada: ${flow.avgSpeed} km/h (límite 80)`,
          lane: null,
          timestamp: new Date(),
          resolved: false,
          source: 'LOOP',
        });
      }
    }

    // High occupancy
    if (flow.occupancy > 75) {
      const prevOcc = prevRef.current?.flow?.occupancy || 0;
      if (prevOcc <= 75) {
        newAlerts.push({
          id: nextId(),
          severity: 'warning',
          message: `Ocupación vial alta: ${flow.occupancy}%`,
          lane: null,
          timestamp: new Date(),
          resolved: false,
          source: 'SISTEMA',
        });
      }
    }

    prevRef.current = sensorData;

    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const updated = prev.map(a => {
          if (!a.resolved && (Date.now() - a.timestamp.getTime()) > 45000) {
            return { ...a, resolved: true };
          }
          return a;
        });
        return [...newAlerts, ...updated].slice(0, 30);
      });
    } else {
      setAlerts(prev => {
        let changed = false;
        const updated = prev.map(a => {
          if (!a.resolved && (Date.now() - a.timestamp.getTime()) > 45000) {
            changed = true;
            return { ...a, resolved: true };
          }
          return a;
        });
        return changed ? updated : prev;
      });
    }
  }, [sensorData]);

  const unreadCount = alerts.filter(a => !a.resolved).length;

  return { alerts, unreadCount };
}
