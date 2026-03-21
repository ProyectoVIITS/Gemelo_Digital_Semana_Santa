/**
 * VIITS NEXUS — Utilidades del módulo de Accidentabilidad Predictiva
 * IRA: Índice de Riesgo de Accidentabilidad
 * Fuente: Base DITRA/INVÍAS 2023–2025
 */

// Niveles de riesgo
export function getNivelRiesgo(ira) {
  if (ira >= 80) return 'MUY_ALTO';
  if (ira >= 60) return 'ALTO';
  if (ira >= 40) return 'MEDIO';
  return 'BAJO';
}

// Colores por nivel de riesgo
export const RIESGO_COLORS = {
  MUY_ALTO: '#7f1d1d',  // Carmesí — zona negra
  ALTO:     '#ef4444',   // Rojo
  MEDIO:    '#f97316',   // Naranja
  BAJO:     '#eab308',   // Amarillo
};

// Íconos por nivel
export const RIESGO_ICONS = {
  MUY_ALTO: '⬟',
  ALTO:     '▲',
  MEDIO:    '◆',
  BAJO:     '●',
};

// Labels por nivel
export const RIESGO_LABELS = {
  MUY_ALTO: 'ZONA NEGRA',
  ALTO:     'ALTO',
  MEDIO:    'MEDIO',
  BAJO:     'BAJO',
};

// Rangos por nivel
export const RIESGO_RANGES = {
  MUY_ALTO: 'IRA 80-100',
  ALTO:     'IRA 60-79',
  MEDIO:    'IRA 40-59',
  BAJO:     'IRA < 40',
};
