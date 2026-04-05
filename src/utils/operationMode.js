/**
 * VIITS NEXUS — Operation Mode Resolver
 * Detecta automáticamente si el sistema está en modo SALIDA o RETORNO
 * basado en la fecha actual de Colombia (America/Bogota UTC-5).
 *
 * Principio: La lógica de salida NUNCA se modifica.
 * El retorno es una capa adicional que se activa por fecha.
 */

const TZ = 'America/Bogota';
import { useTrafficStore } from '../store/trafficStore';

/**
 * Calendario de operaciones DITRA 2026
 * Fechas de retorno: flujo vehicular hacia Bogotá y ciudades principales
 * Fechas de salida: flujo vehicular saliendo de Bogotá hacia destinos
 */
const OPERATION_CALENDAR = {
  // Festivo San José — Retorno progresivo
  '2026-03-22': { mode: 'retorno_progresivo', label: 'Operación Retorno · Inicio Progresivo', startHour: 14 },
  '2026-03-23': { mode: 'retorno', label: 'Operación Retorno · Lunes Festivo' },

  // Días laborales previos
  '2026-03-24': { mode: 'bidireccional', label: 'Tráfico Normal · Martes' },
  '2026-03-25': { mode: 'bidireccional', label: 'Tráfico Normal · Miércoles' },
  '2026-03-26': { mode: 'bidireccional', label: 'Tráfico Normal · Jueves' },
  '2026-03-27': { mode: 'bidireccional', label: 'Presentación DITRA — MinTransporte' },

  // ═══ OPERACIÓN ÉXODO SEMANA SANTA 2026 ═══
  // Resolución MinTransporte: restricción carga ≥3.4t
  // Escala por nivel de éxodo: normal (70/30), alto (75/25), pleno (80/20)
  // 4,007,213 pasajeros proyectados · 336,175 vehículos desde terminales
  '2026-03-28': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Inicio Oficial', level: 'normal', restriccionCarga: { start: 15, end: 22 } },
  '2026-03-29': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Domingo de Ramos', level: 'normal' },
  '2026-03-30': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Lunes Santo', level: 'normal' },
  '2026-03-31': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Martes Santo', level: 'alto' },
  '2026-04-01': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Miércoles Santo', level: 'alto', restriccionCarga: { start: 12, end: 23 } },
  '2026-04-02': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Jueves Santo — ÉXODO PLENO', level: 'pleno', restriccionCarga: { start: 6, end: 15 } },
  '2026-04-03': { mode: 'exodo', label: 'OPERACIÓN ÉXODO · Viernes Santo', level: 'pleno' },
  '2026-04-04': { mode: 'retorno_progresivo', label: 'Operación Retorno · Sábado de Gloria', startHour: 14, restriccionCarga: { start: 14, end: 23 } },
  '2026-04-05': { mode: 'retorno', label: 'Operación Retorno · Domingo de Resurrección', restriccionCarga: { start: 10, end: 23 } },
};

/**
 * Perfil de distribución BIDIRECCIONAL — días laborales normales
 * 60% salida / 40% retorno → retornoScale = 0.40
 * Horario pico AM: 6-9h (más retorno entrando a ciudades)
 * Horario pico PM: 5-8h (más salida saliendo de ciudades)
 */
const BIDIRECTIONAL_SCALE = {
  0: 0.40, 1: 0.40, 2: 0.40, 3: 0.40, 4: 0.40, 5: 0.45,
  6: 0.50, 7: 0.50, 8: 0.50, 9: 0.45, // AM: más retorno (gente entra a trabajar)
  10: 0.40, 11: 0.40, 12: 0.40,
  13: 0.40, 14: 0.40, 15: 0.38,
  16: 0.35, 17: 0.35, 18: 0.35, 19: 0.38, // PM: más salida (gente sale)
  20: 0.40, 21: 0.40, 22: 0.40, 23: 0.40,
};

/**
 * Obtener fecha actual de Colombia como string YYYY-MM-DD
 */
export function getColombiaDate() {
  const now = new Date();
  const year = now.toLocaleString('en-US', { year: 'numeric', timeZone: TZ });
  const month = now.toLocaleString('en-US', { month: '2-digit', timeZone: TZ });
  const day = now.toLocaleString('en-US', { day: '2-digit', timeZone: TZ });
  return `${year}-${month}-${day}`;
}

/**
 * Obtener hora actual de Colombia (0-23)
 * Centralizado — reemplaza duplicación en useTollData y useCorridorData
 */
export function getColombiaHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }),
    10
  );
}

/**
 * Escala progresiva de casetas de retorno según hora del día
 * Aplica a peajes durante "retorno_progresivo": se van habilitando casetas
 * a medida que crece la demanda.
 *
 * Ejemplo Chuzacá (10 casetas, 1 retorno base):
 *   14h: 3 casetas retorno (arranque)
 *   16h: 4 casetas retorno
 *   18h: 5 casetas retorno
 *   20h: 4 casetas retorno (baja nocturna)
 *
 * El lunes festivo (retorno completo):
 *   06h: 4 casetas
 *   10h: 6 casetas
 *   13h-17h: 8-9 casetas (pico máximo)
 *   20h: 5 casetas
 *   23h: 3 casetas
 */
const RETORNO_PROGRESSIVE_SCALE = {
  // hora → fracción de casetas totales destinadas a retorno
  // Domingo 22: inicio a las 14h
  progressive: {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
    10: 0, 11: 0,
    12: 0.10, // Pre-retorno: primeros vehículos regresando (1 caseta retorno visible)
    13: 0.15, // Pre-retorno: flujo creciente de anticipación
    14: 0.30, // ARRANQUE OFICIAL: 3 casetas retorno (reporte DITRA)
    15: 0.35,
    16: 0.40, // 4/10
    17: 0.45,
    18: 0.50, // 5/10
    19: 0.45,
    20: 0.40,
    21: 0.35,
    22: 0.30,
    23: 0.25,
  },
  // Lunes festivo — desescalamiento nocturno, mañana día laboral
  // Google Routes 19:30h: retorno 22 km/h (50%), salida 15 km/h (70%)
  // Retorno bajando → equilibrar 5/5 a partir de 19h
  full: {
    0: 0.20, 1: 0.20, 2: 0.20, 3: 0.20, 4: 0.25, 5: 0.35,
    6: 0.50, 7: 0.55, 8: 0.60, 9: 0.70,
    10: 0.75, 11: 0.80, 12: 0.80,
    13: 0.80, 14: 0.80, 15: 0.80, 16: 0.80, 17: 0.80,
    18: 0.80, 19: 0.80, 20: 0.80, 
    21: 0.70, 22: 0.60, 23: 0.50,
  },
};

/**
 * Determinar el modo de operación actual
 * @returns {{ mode: string, label: string, isRetorno: boolean, retornoScale: number }}
 */
export function getOperationMode() {
  const dateStr = getColombiaDate();
  const hour = getColombiaHour();
  
  // Utiliza el calendario descargado del backend si existe, sino el fallback local.
  const stateCalendar = useTrafficStore.getState().calendar;
  const calendar = (stateCalendar && Object.keys(stateCalendar).length > 0) ? stateCalendar : OPERATION_CALENDAR;
  
  const entry = calendar[dateStr];

  if (entry) {
    if (entry.mode === 'retorno_progresivo') {
      const scale = RETORNO_PROGRESSIVE_SCALE.progressive[hour] || 0;
      // Si la escala es > 0, activar modo retorno (incluye pre-retorno 12-13h)
      if (scale > 0) {
        const isPreRetorno = hour < entry.startHour;
        return {
          mode: 'retorno',
          label: isPreRetorno ? entry.label + ' · Pre-retorno' : entry.label,
          isRetorno: true,
          retornoScale: scale,
        };
      }
      // Sin escala: salida normal
      return {
        mode: 'salida',
        label: entry.label + ' (previo)',
        isRetorno: false,
        retornoScale: 0,
      };
    }

    if (entry.mode === 'retorno') {
      const scale = RETORNO_PROGRESSIVE_SCALE.full[hour] || 0.50;
      return {
        mode: 'retorno',
        label: entry.label,
        isRetorno: true,
        retornoScale: scale,
      };
    }

    if (entry.mode === 'exodo') {
      // ÉXODO: escala dinámica por nivel de éxodo y hora del día
      // normal: 70/30, alto: 75/25 en picos, pleno: 80/20 en picos (98% congestión)
      const level = entry.level || 'normal';
      let retScale;
      if (level === 'pleno') {
        // ÉXODO PLENO (Jueves Santo): 80/20 en picos AM/PM
        const isPeakAM = hour >= 7 && hour <= 9;
        const isPeakPM = hour >= 14 && hour <= 16;
        retScale = (isPeakAM || isPeakPM) ? 0.20 : 0.25;
      } else if (level === 'alto') {
        // ÉXODO ALTO (Miércoles/Viernes Santo): 75/25 en picos
        const isPeakAM = hour >= 6 && hour <= 9;
        const isPeakPM = hour >= 14 && hour <= 17;
        retScale = (isPeakAM || isPeakPM) ? 0.25 : 0.30;
      } else {
        // ÉXODO NORMAL: 70/30 constante
        retScale = 0.30;
      }
      return {
        mode: 'exodo',
        label: entry.label,
        isRetorno: false,
        isExodo: true,
        exodoLevel: level,
        retornoScale: retScale,
        restriccionCarga: entry.restriccionCarga || null,
      };
    }

    if (entry.mode === 'bidireccional') {
      const scale = BIDIRECTIONAL_SCALE[hour] || 0.40;
      return {
        mode: 'bidireccional',
        label: entry.label,
        isRetorno: false, // no es retorno puro, es bidireccional
        isBidirectional: true,
        retornoScale: scale,
      };
    }

    return {
      mode: entry.mode,
      label: entry.label,
      isRetorno: false,
      retornoScale: 0,
    };
  }

  // Default: bidireccional 60/40 para cualquier día no programado
  const scale = BIDIRECTIONAL_SCALE[hour] || 0.40;
  return {
    mode: 'bidireccional',
    label: 'Monitor Vial VIITS NEXUS',
    isRetorno: false,
    isBidirectional: true,
    retornoScale: scale,
  };
}

/**
 * Calcular casetas activas de retorno para un peaje dado
 * @param {object} boothConfig - { total, salida, retorno }
 * @returns {{ retornoActivas: number, salidaActivas: number }}
 */
export function getActiveBooths(boothConfig) {
  const opMode = getOperationMode();
  const { isRetorno, retornoScale } = opMode;
  const isBidirectional = opMode.isBidirectional || false;
  const isExodo = opMode.isExodo || false;
  const total = boothConfig.total;

  if (isExodo) {
    // ÉXODO: 70% casetas salida, 30% casetas retorno
    // Mínimo 1 caseta de retorno (siempre hay tráfico de entrada mínimo)
    const retornoDeseadas = Math.max(1, Math.round(total * retornoScale));
    const salidaActivas = total - retornoDeseadas;
    return {
      retornoActivas: retornoDeseadas,
      salidaActivas,
      totalActivas: total,
    };
  }

  if (isBidirectional) {
    // Bidireccional: distribución 60/40 — TODAS las casetas activas
    const retornoDeseadas = Math.max(1, Math.round(total * retornoScale));
    const salidaActivas = total - retornoDeseadas;
    return {
      retornoActivas: retornoDeseadas,
      salidaActivas,
      totalActivas: total,
    };
  }

  if (!isRetorno) {
    // Salida pura (festivos de salida): casetas retorno cerradas
    return {
      retornoActivas: 0,
      salidaActivas: total,
      totalActivas: total,
    };
  }

  // Retorno: escalar casetas progresivamente
  const retornoDeseadas = Math.round(total * retornoScale);
  const retornoActivas = Math.max(boothConfig.retorno, Math.min(retornoDeseadas, total - 1));
  const salidaActivas = total - retornoActivas;

  return {
    retornoActivas,
    salidaActivas,
    totalActivas: total,
  };
}

/**
 * Corredores críticos durante retorno (IRT más alto, peajes de entrada a Bogotá)
 */
export const CRITICAL_RETURN_CORRIDORS = ['C3', 'C5', 'C6'];
