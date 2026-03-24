/**
 * VIITS NEXUS — Operation Mode Resolver
 * Detecta automáticamente si el sistema está en modo SALIDA o RETORNO
 * basado en la fecha actual de Colombia (America/Bogota UTC-5).
 *
 * Principio: La lógica de salida NUNCA se modifica.
 * El retorno es una capa adicional que se activa por fecha.
 */

const TZ = 'America/Bogota';

/**
 * Calendario de operaciones DITRA 2026
 * Fechas de retorno: flujo vehicular hacia Bogotá y ciudades principales
 * Fechas de salida: flujo vehicular saliendo de Bogotá hacia destinos
 */
const OPERATION_CALENDAR = {
  // Festivo San José — Retorno progresivo
  '2026-03-22': { mode: 'retorno_progresivo', label: 'Operación Retorno · Inicio Progresivo', startHour: 14 },
  '2026-03-23': { mode: 'retorno', label: 'Operación Retorno · Lunes Festivo' },

  // Semana Santa 2026
  '2026-04-02': { mode: 'salida',  label: 'Operación Salida · Jueves Santo' },
  '2026-04-03': { mode: 'salida',  label: 'Operación Salida · Viernes Santo' },
  '2026-04-04': { mode: 'retorno_progresivo', label: 'Operación Retorno · Sábado de Gloria', startHour: 12 },
  '2026-04-05': { mode: 'retorno', label: 'Operación Retorno · Domingo de Resurrección' },
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
    13: 0.80, 14: 0.80, 15: 0.80, 16: 0.80, 17: 0.75,
    18: 0.50, 19: 0.50, // ← 5 retorno / 5 salida equilibrado
    20: 0.50, 21: 0.50, 22: 0.50, 23: 0.50,
  },
};

/**
 * Determinar el modo de operación actual
 * @returns {{ mode: string, label: string, isRetorno: boolean, retornoScale: number }}
 */
export function getOperationMode() {
  const dateStr = getColombiaDate();
  const hour = getColombiaHour();
  const entry = OPERATION_CALENDAR[dateStr];

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

    return {
      mode: entry.mode,
      label: entry.label,
      isRetorno: false,
      retornoScale: 0,
    };
  }

  // Default: salida
  return {
    mode: 'salida',
    label: 'Monitor Semana Santa 2026',
    isRetorno: false,
    retornoScale: 0,
  };
}

/**
 * Calcular casetas activas de retorno para un peaje dado
 * @param {object} boothConfig - { total, salida, retorno }
 * @returns {{ retornoActivas: number, salidaActivas: number }}
 */
export function getActiveBooths(boothConfig) {
  const { isRetorno, retornoScale } = getOperationMode();
  const total = boothConfig.total;

  if (!isRetorno) {
    // Salida normal: todas menos las de retorno
    return {
      retornoActivas: boothConfig.retorno,
      salidaActivas: boothConfig.salida,
      totalActivas: total,
    };
  }

  // Retorno: escalar casetas progresivamente
  // Mínimo = casetas de retorno fijas, Máximo = total - 1 (dejar al menos 1 de salida)
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
