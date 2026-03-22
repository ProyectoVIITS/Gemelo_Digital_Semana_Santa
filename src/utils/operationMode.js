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
  // Festivo San José (lunes festivo marzo)
  '2026-03-23': { mode: 'retorno', label: 'Operación Retorno · Lunes Festivo' },

  // Semana Santa 2026
  '2026-04-02': { mode: 'salida',  label: 'Operación Salida · Jueves Santo' },
  '2026-04-03': { mode: 'salida',  label: 'Operación Salida · Viernes Santo' },
  '2026-04-04': { mode: 'retorno', label: 'Operación Retorno · Sábado de Gloria' },
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
 * Determinar el modo de operación actual
 * @returns {{ mode: 'retorno'|'salida', label: string, isRetorno: boolean }}
 */
export function getOperationMode() {
  const dateStr = getColombiaDate();
  const entry = OPERATION_CALENDAR[dateStr];

  if (entry) {
    return {
      mode: entry.mode,
      label: entry.label,
      isRetorno: entry.mode === 'retorno',
    };
  }

  // Default: salida (comportamiento actual sin cambios)
  return {
    mode: 'salida',
    label: 'Monitor Semana Santa 2026',
    isRetorno: false,
  };
}

/**
 * Corredores críticos durante retorno (IRT más alto, peajes de entrada a Bogotá)
 */
export const CRITICAL_RETURN_CORRIDORS = ['C3', 'C5', 'C6'];
