/**
 * VIITS — Motor de Alertas Inteligentes
 * Genera alertas contextuales basadas en IRT, clima, hora, tasa de crecimiento
 * y puntos de bloqueo específicos por corredor.
 */

import { getNivelAlerta } from './irtEngine';

const SEVERITY_ORDER = { info: 0, warning: 1, critical: 2, emergency: 3 };

/**
 * Evalúa todas las condiciones y genera alertas inteligentes.
 */
export function evaluateAlerts({ corridorMetrics, corridors, selectedDay, selectedHour }) {
  const alerts = [];
  const now = Date.now();

  corridors.forEach(corridor => {
    const m = corridorMetrics[corridor.id];
    if (!m) return;
    const { irt, volume, tasaCrecimiento, nivelLluvia, factorFestivo } = m;
    const alerta = getNivelAlerta(irt);

    // 1. IRT Threshold Alerts
    if (irt > 90) {
      alerts.push({
        id: `${corridor.id}-colapso`,
        corridorId: corridor.id,
        severity: 'emergency',
        type: 'irt_threshold',
        title: `COLAPSO: ${corridor.name}`,
        message: `IRT ${irt}/100 — Tiempo de viaje hasta 4.5x lo normal. Vía prácticamente detenida.`,
        recommendation: 'Evitar esta ruta. Buscar alternativas o postergar viaje.',
        color: alerta.color,
        timestamp: now,
      });
    } else if (irt > 80) {
      alerts.push({
        id: `${corridor.id}-critico`,
        corridorId: corridor.id,
        severity: 'critical',
        type: 'irt_threshold',
        title: `CRÍTICO: ${corridor.name}`,
        message: `IRT ${irt}/100 — Congestión severa en el corredor.`,
        recommendation: 'Salir antes de las 6am o después de las 7pm.',
        color: alerta.color,
        timestamp: now,
      });
    } else if (irt > 65) {
      alerts.push({
        id: `${corridor.id}-congestion`,
        corridorId: corridor.id,
        severity: 'warning',
        type: 'irt_threshold',
        title: `Congestión: ${corridor.name}`,
        message: `IRT ${irt}/100 — Tráfico denso, tiempos incrementados.`,
        recommendation: 'Considere horarios alternativos.',
        color: alerta.color,
        timestamp: now,
      });
    }

    // 2. Compound Weather Alert
    if (nivelLluvia >= 1 && irt > 55) {
      const rainLabel = nivelLluvia === 2 ? 'intensa' : 'moderada';
      alerts.push({
        id: `${corridor.id}-weather`,
        corridorId: corridor.id,
        severity: nivelLluvia === 2 && irt > 70 ? 'critical' : 'warning',
        type: 'weather_compound',
        title: `Lluvia ${rainLabel} + Congestión: ${corridor.name}`,
        message: `Lluvia ${rainLabel} agrava congestión (IRT ${irt}). Región ${corridor.region}.`,
        recommendation: 'Reducir velocidad. Riesgo de deslizamientos en zonas de montaña.',
        color: '#3b82f6',
        timestamp: now,
      });
    }

    // 3. Rapid Growth Alert (early warning)
    if (tasaCrecimiento > 0.20 && irt > 45) {
      alerts.push({
        id: `${corridor.id}-growth`,
        corridorId: corridor.id,
        severity: 'warning',
        type: 'rapid_growth',
        title: `Crecimiento rápido: ${corridor.name}`,
        message: `Volumen creciendo ${Math.round(tasaCrecimiento * 100)}%/hora. El corredor podría saturarse pronto.`,
        recommendation: 'Salir ahora antes de que empeore.',
        color: '#a855f7',
        timestamp: now,
      });
    }

    // 4. Capacity Breach Alert
    if (volume > corridor.normalCapacityVehHr) {
      const exceso = Math.round(((volume / corridor.normalCapacityVehHr) - 1) * 100);
      alerts.push({
        id: `${corridor.id}-capacity`,
        corridorId: corridor.id,
        severity: exceso > 50 ? 'critical' : 'warning',
        type: 'capacity_breach',
        title: `Capacidad excedida: ${corridor.name}`,
        message: `${volume.toLocaleString()} veh/h vs capacidad ${corridor.normalCapacityVehHr.toLocaleString()} (+${exceso}%).`,
        recommendation: 'Flujo forzado. Preparar plan de contingencia.',
        color: '#f97316',
        timestamp: now,
      });
    }

    // 5. Critical toll station alerts
    if (irt > 70 && corridor.peajes) {
      const criticalTolls = corridor.peajes.filter(p => p.critico);
      criticalTolls.forEach(toll => {
        const tollIRT = Math.min(irt + 5, 100); // critico: +5 IRT
        if (tollIRT > 75) {
          alerts.push({
            id: `${corridor.id}-toll-${toll.id}`,
            corridorId: corridor.id,
            severity: tollIRT > 85 ? 'emergency' : 'critical',
            type: 'bottleneck',
            title: `Peaje ${toll.nombre} (${toll.km})`,
            message: `IRT peaje: ${tollIRT}. Punto crítico del corredor ${corridor.name}.`,
            recommendation: 'Use pago electrónico. Considere horarios alternativos.',
            color: alerta.color,
            timestamp: now,
          });
        }
      });
    }

    // 6. Time Window Advisory
    const isExitDay = [3, 4, 5].includes(selectedDay);
    const isReturnDay = [6, 7].includes(selectedDay);
    if (isExitDay && selectedHour >= 8 && selectedHour <= 14 && irt > 50) {
      alerts.push({
        id: `${corridor.id}-time-exit`,
        corridorId: corridor.id,
        severity: 'info',
        type: 'time_window',
        title: `Ventana de alto tráfico: ${corridor.name}`,
        message: `Hora pico de éxodo (${selectedHour}:00). IRT ${irt}.`,
        recommendation: 'Salir antes de las 6am o después de las 6pm.',
        color: '#6366f1',
        timestamp: now,
      });
    }
    if (isReturnDay && selectedHour >= 13 && selectedHour <= 18 && irt > 50) {
      alerts.push({
        id: `${corridor.id}-time-return`,
        corridorId: corridor.id,
        severity: 'info',
        type: 'time_window',
        title: `Ventana de retorno: ${corridor.name}`,
        message: `Hora pico de retorno (${selectedHour}:00). IRT ${irt}.`,
        recommendation: 'Retornar temprano en la mañana o después de las 8pm.',
        color: '#6366f1',
        timestamp: now,
      });
    }
  });

  // Sort by severity (emergency first) then by IRT
  alerts.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return 0;
  });

  return alerts;
}

/**
 * Filtra alertas nuevas de nivel critical/emergency para el log de eventos.
 */
export function extractCriticalEvents(alerts, existingLog) {
  const existingIds = new Set(existingLog.map(e => e.id));
  return alerts
    .filter(a => (a.severity === 'critical' || a.severity === 'emergency') && !existingIds.has(a.id))
    .map(a => ({ ...a, loggedAt: Date.now() }));
}
