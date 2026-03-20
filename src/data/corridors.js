/**
 * VIITS — Datos de Corredores Viales
 * Fuentes: MinTransporte, INVÍAS, ANI, ANSV, IDEAM (2024-2025)
 * Valores estimados documentados con metodología en data/research_notes.md
 */

// ═══════════════════════════════════════════════════════════════
// PERFILES HORARIOS POR CORREDOR — Éxodo (salida desde Bogotá)
// Cada corredor tiene patrones de tráfico distintos según su
// distancia, tipo de destino y características operativas.
// ═══════════════════════════════════════════════════════════════

// BOGOTÁ-GIRARDOT: Corredor corto turístico (134km, 2.5h)
// Pico pronunciado 5-9am (familias madrugadoras), segundo pico menor ~2pm
// Caída rápida por la noche
const GIRARDOT_EXIT = [
  0.010, 0.008, 0.008, 0.012, 0.025, 0.060,  // 0-5h: arrancón fuerte desde 5am
  0.095, 0.110, 0.105, 0.088, 0.072, 0.058,   // 6-11h: pico 7am, desciende gradual
  0.055, 0.062, 0.068, 0.058, 0.042, 0.030,   // 12-17h: segundo pulso 2pm
  0.020, 0.015, 0.010, 0.008, 0.005, 0.004    // 18-23h: mínimo nocturno
];
const GIRARDOT_RETURN = [
  0.005, 0.004, 0.004, 0.005, 0.008, 0.012,   // 0-5h: madrugada mínima
  0.020, 0.028, 0.035, 0.045, 0.058, 0.068,   // 6-11h: salidas graduales
  0.078, 0.088, 0.095, 0.105, 0.098, 0.085,   // 12-17h: PICO retorno 3-4pm
  0.065, 0.045, 0.025, 0.015, 0.010, 0.006    // 18-23h: cola de retorno
];
const GIRARDOT_NORMAL = [
  0.012, 0.008, 0.008, 0.010, 0.018, 0.035,
  0.058, 0.072, 0.078, 0.075, 0.068, 0.060,
  0.055, 0.052, 0.058, 0.065, 0.060, 0.052,
  0.042, 0.035, 0.028, 0.022, 0.018, 0.012
];

// BOGOTÁ-MEDELLÍN: Corredor largo interurbano (420km, 8.5h)
// Salidas muy tempranas (3-5am) para llegar de día
// Pico 4-7am, luego flujo sostenido moderado todo el día
const MEDELLIN_EXIT = [
  0.015, 0.018, 0.025, 0.045, 0.070, 0.090,   // 0-5h: salidas desde 3am!
  0.100, 0.095, 0.082, 0.068, 0.058, 0.050,   // 6-11h: pico ya pasó, descenso
  0.048, 0.045, 0.042, 0.040, 0.035, 0.028,   // 12-17h: flujo residual
  0.020, 0.015, 0.012, 0.008, 0.005, 0.004    // 18-23h: casi nulo
];
const MEDELLIN_RETURN = [
  0.008, 0.005, 0.005, 0.008, 0.012, 0.018,   // 0-5h: pocas salidas
  0.035, 0.048, 0.058, 0.065, 0.072, 0.078,   // 6-11h: crecimiento gradual
  0.082, 0.088, 0.092, 0.088, 0.080, 0.068,   // 12-17h: meseta alta 12-3pm
  0.050, 0.038, 0.028, 0.020, 0.012, 0.008    // 18-23h: descenso
];
const MEDELLIN_NORMAL = [
  0.015, 0.012, 0.012, 0.015, 0.022, 0.035,
  0.052, 0.062, 0.068, 0.065, 0.060, 0.058,
  0.055, 0.055, 0.058, 0.062, 0.058, 0.052,
  0.045, 0.038, 0.032, 0.025, 0.020, 0.015
];

// BOGOTÁ-VILLAVICENCIO: Corredor cuello de botella (120km, 2.5h)
// Pico ULTRA concentrado 5-8am por km 18 — todos quieren pasar temprano
// Cola brutal que se mantiene hasta mediodía, luego cae drásticamente
const VILLAVO_EXIT = [
  0.008, 0.005, 0.005, 0.010, 0.030, 0.075,   // 0-5h: explosión desde 5am
  0.115, 0.120, 0.108, 0.085, 0.068, 0.055,   // 6-11h: PICO MÁXIMO 7am (km 18)
  0.048, 0.042, 0.038, 0.035, 0.028, 0.022,   // 12-17h: descenso pronunciado
  0.018, 0.012, 0.008, 0.005, 0.004, 0.003    // 18-23h: nulo (nadie sale)
];
const VILLAVO_RETURN = [
  0.004, 0.003, 0.003, 0.004, 0.006, 0.010,   // 0-5h: vacío
  0.018, 0.025, 0.035, 0.050, 0.065, 0.078,   // 6-11h: inicio retorno
  0.092, 0.100, 0.108, 0.112, 0.100, 0.082,   // 12-17h: PICO retorno 3pm
  0.055, 0.035, 0.020, 0.012, 0.008, 0.005    // 18-23h: cola final
];
const VILLAVO_NORMAL = [
  0.015, 0.010, 0.010, 0.012, 0.020, 0.038,
  0.060, 0.075, 0.080, 0.072, 0.065, 0.058,
  0.055, 0.050, 0.055, 0.060, 0.055, 0.048,
  0.040, 0.032, 0.025, 0.020, 0.015, 0.012
];

// COSTA CARIBE: Corredor turístico costero (235km)
// Tráfico más repartido, pico tardío 9am-1pm (turismo de playa, sin prisa)
// Actividad nocturna más alta que otros corredores (vida nocturna costera)
const CARIBE_EXIT = [
  0.012, 0.010, 0.010, 0.012, 0.018, 0.028,   // 0-5h: algo de madrugada
  0.042, 0.058, 0.075, 0.092, 0.098, 0.095,   // 6-11h: pico tardío 10-11am
  0.088, 0.078, 0.068, 0.058, 0.050, 0.042,   // 12-17h: desciende suave
  0.035, 0.030, 0.025, 0.022, 0.018, 0.015    // 18-23h: actividad nocturna
];
const CARIBE_RETURN = [
  0.012, 0.010, 0.008, 0.008, 0.010, 0.015,   // 0-5h: mínimo
  0.025, 0.035, 0.048, 0.058, 0.068, 0.075,   // 6-11h: arranque gradual
  0.085, 0.092, 0.095, 0.090, 0.082, 0.068,   // 12-17h: pico 2-3pm
  0.048, 0.035, 0.025, 0.018, 0.015, 0.012    // 18-23h: descenso
];
const CARIBE_NORMAL = [
  0.018, 0.015, 0.012, 0.015, 0.020, 0.028,
  0.042, 0.055, 0.065, 0.072, 0.075, 0.072,
  0.068, 0.062, 0.058, 0.058, 0.055, 0.050,
  0.042, 0.038, 0.032, 0.028, 0.022, 0.018
];

// Nombres y fechas de los días de Semana Santa 2026
export const DAYS = [
  { index: 0, date: '29 Mar', name: 'Domingo de Ramos', short: 'Dom 29', isHighlight: false, isSunday: true },
  { index: 1, date: '30 Mar', name: 'Lunes Santo', short: 'Lun 30', isHighlight: false, isSunday: false },
  { index: 2, date: '31 Mar', name: 'Martes Santo', short: 'Mar 31', isHighlight: false, isSunday: false },
  { index: 3, date: '1 Abr', name: 'Miércoles Santo', short: 'Mié 1', isHighlight: false, isSunday: false },
  { index: 4, date: '2 Abr', name: 'Jueves Santo', short: 'Jue 2', isHighlight: true, isSunday: false },
  { index: 5, date: '3 Abr', name: 'Viernes Santo', short: 'Vie 3', isHighlight: true, isSunday: false },
  { index: 6, date: '4 Abr', name: 'Sábado de Gloria', short: 'Sáb 4', isHighlight: false, isSunday: false },
  { index: 7, date: '5 Abr', name: 'Domingo de Resurrección', short: 'Dom 5', isHighlight: true, isSunday: true },
];

// Factor de volumen por día (normalizado, donde Viernes Santo = 1.0)
// Fuente: distribución porcentual documentada MinTransporte
const DAY_VOLUME_FACTORS = [0.36, 0.27, 0.32, 0.55, 0.91, 1.00, 0.64, 0.50];

// Perfiles horarios por corredor y tipo de día
// [exit, return, normal] para cada corredor
const CORRIDOR_PROFILES = {
  'bogota-girardot':      { exit: GIRARDOT_EXIT, return: GIRARDOT_RETURN, normal: GIRARDOT_NORMAL },
  'bogota-medellin':      { exit: MEDELLIN_EXIT, return: MEDELLIN_RETURN, normal: MEDELLIN_NORMAL },
  'bogota-villavicencio': { exit: VILLAVO_EXIT,  return: VILLAVO_RETURN,  normal: VILLAVO_NORMAL },
  'costa-caribe':         { exit: CARIBE_EXIT,   return: CARIBE_RETURN,   normal: CARIBE_NORMAL },
};

// Tipo de día: 'exit', 'return', 'normal'
const DAY_TYPES = [
  'exit',    // Dom Ramos — salidas
  'normal',  // Lunes
  'normal',  // Martes
  'exit',    // Miércoles — pre-éxodo
  'exit',    // Jueves Santo — pico éxodo
  'exit',    // Viernes Santo — pico máximo
  'return',  // Sábado Gloria — inicio retorno
  'return',  // Domingo Resurrección — pico retorno
];

/**
 * Obtiene el perfil horario base (sin clima) para un corredor y día.
 */
function getCorridorDayProfileBase(corridorId, dayIndex) {
  const profiles = CORRIDOR_PROFILES[corridorId];
  if (!profiles) return GIRARDOT_EXIT;
  const dayType = DAY_TYPES[dayIndex];
  return profiles[dayType] || profiles.normal;
}

// ═══════════════════════════════════════════════════════════════
// AJUSTE CLIMÁTICO AL PERFIL HORARIO
// Fuentes: FHWA Empirical Studies, Ibrahim & Hall 1994,
//          MinTransporte Colombia, IDEAM patrones regionales
//
// Efectos documentados de la lluvia en patrones de tráfico:
// - Lluvia moderada: reducción 10-15% pico, redistribución leve
// - Lluvia intensa: reducción 20-30% pico, aplana curva significativamente
// - Corredores de montaña (andina/orinoquia): efecto amplificado
//   por deslizamientos, niebla, curvas peligrosas
// - Costa Caribe: mínimo impacto (época seca en Semana Santa)
// - Las personas adelantan o postergan salidas, aplanando el pico
// - En lluvia intensa: "efecto espera" — volumen baja, luego surge
//   al aclarar, creando picos irregulares
// ═══════════════════════════════════════════════════════════════

// Factor de sensibilidad climática por región
const REGION_RAIN_SENSITIVITY = {
  andina: 1.0,      // Máxima sensibilidad: montaña, curvas, niebla, deslizamientos
  orinoquia: 0.85,   // Alta: paso de montaña (km 18) + descenso al llano
  caribe: 0.25,      // Baja: zona seca en Semana Santa, terreno plano
};

/**
 * Aplica el efecto climático a un perfil horario base.
 * nivelLluvia: 0=sin lluvia, 1=moderada, 2=intensa
 *
 * Efectos implementados:
 * 1. Reducción proporcional de picos (más lluvia = más aplanamiento)
 * 2. Redistribución: parte del volumen pico se desplaza a horas adyacentes
 * 3. En lluvia intensa: "efecto espera" con micro-surto post-lluvia
 * 4. Reducción general de viajes discrecionales
 * 5. Mayor efecto en montaña que en costa
 */
function applyWeatherToProfile(baseProfile, nivelLluvia, region) {
  if (nivelLluvia === 0) return baseProfile;

  const sensitivity = REGION_RAIN_SENSITIVITY[region] || 0.5;
  const maxVal = Math.max(...baseProfile);
  const adjusted = [...baseProfile];

  if (nivelLluvia === 1) {
    // ── LLUVIA MODERADA ──
    // Reducción 10-18% de picos (según sensibilidad regional)
    // Redistribución: 40% del volumen reducido va a horas adyacentes
    const peakReduction = 0.12 * sensitivity;     // 12% en andina, 3% en caribe
    const redistributionRate = 0.40;
    const overallReduction = 0.05 * sensitivity;   // Algunos cancelan viaje

    for (let h = 0; h < 24; h++) {
      const isPeakish = baseProfile[h] > maxVal * 0.7;
      const isNearPeak = baseProfile[h] > maxVal * 0.5;

      if (isPeakish) {
        // Reducir picos
        const reduction = baseProfile[h] * peakReduction;
        adjusted[h] -= reduction;
        // Redistribuir a horas adyacentes (±1-2h)
        const redistribution = reduction * redistributionRate;
        if (h > 0) adjusted[h - 1] += redistribution * 0.35;
        if (h > 1) adjusted[h - 2] += redistribution * 0.15;
        if (h < 23) adjusted[h + 1] += redistribution * 0.35;
        if (h < 22) adjusted[h + 2] += redistribution * 0.15;
      } else if (isNearPeak) {
        // Reducción menor en zona de transición
        adjusted[h] -= baseProfile[h] * (peakReduction * 0.4);
      }

      // Reducción general (cancelación de viajes discrecionales)
      adjusted[h] *= (1 - overallReduction);
    }
  } else {
    // ── LLUVIA INTENSA ──
    // Reducción 22-35% de picos (según región)
    // Fuerte redistribución + efecto espera
    // Reducción general 12-15% (muchos cancelan viaje)
    const peakReduction = 0.28 * sensitivity;      // 28% andina, 7% caribe
    const redistributionRate = 0.35;
    const overallReduction = 0.12 * sensitivity;    // 12% cancelan en andina
    const waitEffect = 0.08 * sensitivity;          // "Efecto espera y surge"

    for (let h = 0; h < 24; h++) {
      const relativeHeight = baseProfile[h] / maxVal;
      const isPeakish = relativeHeight > 0.7;
      const isNearPeak = relativeHeight > 0.4;

      if (isPeakish) {
        const reduction = baseProfile[h] * peakReduction;
        adjusted[h] -= reduction;
        // Redistribución más dispersa (±2-3h)
        const redistribution = reduction * redistributionRate;
        if (h > 0) adjusted[h - 1] += redistribution * 0.20;
        if (h > 1) adjusted[h - 2] += redistribution * 0.20;
        if (h > 2) adjusted[h - 3] += redistribution * 0.10;
        if (h < 23) adjusted[h + 1] += redistribution * 0.20;
        if (h < 22) adjusted[h + 2] += redistribution * 0.20;
        if (h < 21) adjusted[h + 3] += redistribution * 0.10;
      } else if (isNearPeak) {
        adjusted[h] -= baseProfile[h] * (peakReduction * 0.5);
        // Efecto espera: micro-surge 2h después de hora pico
        if (h < 22 && relativeHeight > 0.5) {
          adjusted[h + 2] += baseProfile[h] * waitEffect;
        }
      }

      // Reducción general mayor (muchos cancelan viaje)
      adjusted[h] *= (1 - overallReduction);
    }

    // En montaña con lluvia intensa: aplanar aún más las madrugadas
    // (nadie sale a las 3am con tormenta en la cordillera)
    if (sensitivity > 0.5) {
      for (let h = 0; h < 5; h++) {
        adjusted[h] *= (1 - 0.30 * sensitivity);
      }
    }
  }

  // Asegurar valores positivos y renormalizar
  const minVal = 0.002;
  for (let h = 0; h < 24; h++) {
    adjusted[h] = Math.max(adjusted[h], minVal);
  }

  return adjusted;
}

// Región por corredor (definido antes de CORRIDORS para evitar referencia circular)
const CORRIDOR_REGIONS = {
  'bogota-girardot': 'andina',
  'bogota-medellin': 'andina',
  'bogota-villavicencio': 'orinoquia',
  'costa-caribe': 'caribe',
};

/**
 * Obtiene el perfil horario para un corredor, día y condición climática.
 * El perfil se ajusta dinámicamente según el nivel de lluvia y la región.
 */
function getCorridorDayProfile(corridorId, dayIndex, nivelLluvia) {
  const baseProfile = getCorridorDayProfileBase(corridorId, dayIndex);
  if (!nivelLluvia || nivelLluvia === 0) return baseProfile;

  const region = CORRIDOR_REGIONS[corridorId] || 'andina';
  return applyWeatherToProfile(baseProfile, nivelLluvia, region);
}

/**
 * Factor festivo histórico por día, hora, corredor y clima.
 * Normalizado 0-1 donde 1 = momento de máxima congestión histórica.
 */
function getFactorFestivo(dayIndex, hour, corridorId, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const profile = getCorridorDayProfile(corridorId, dayIndex, nivelLluvia);
  const hourFactor = profile[hour] / Math.max(...profile);
  const isActiveHour = hour >= 6 && hour <= 21;
  const adjustedHourFactor = isActiveHour ? Math.max(hourFactor, 0.4) : hourFactor;
  return dayFactor * adjustedHourFactor;
}

export const CORRIDORS = [
  {
    id: 'bogota-girardot',
    name: 'Bogotá – Girardot',
    route: 'Ruta 40',
    distanceKm: 134,
    normalTravelTimeHrs: 2.5,
    normalCapacityVehHr: 2200,
    freeFlowSpeedKmh: 80,
    region: 'andina',
    criticalPoints: ['Chusacá', 'Fusagasugá', 'Chinauta', 'Melgar'],
    // Volumen diario pico Viernes Santo (calibrado para IRT ~82 en hora pico sin lluvia)
    peakDayVolume: 40000,
    // Probabilidad de lluvia por día (Fuente: IDEAM, patrón SS 2025)
    rainProbabilityByDay: [0.30, 0.25, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60],
    rainImpactFactor: 1.35,
    // Coordenadas SVG legacy (no usar)
    startCoords: [310, 285],
    endCoords: [280, 350],
    waypoints: [[300, 305], [290, 325]],
    // Coordenadas geográficas reales [lat, lng]
    geoStart: [4.711, -74.072],   // Bogotá
    geoEnd: [4.302, -74.804],     // Girardot
    geoWaypoints: [
      [4.565, -74.217],  // Chusacá
      [4.345, -74.365],  // Fusagasugá
      [4.244, -74.435],  // Chinauta
      [4.199, -74.636],  // Melgar
    ],
    geoCriticalPoints: [
      { name: 'Chusacá', coords: [4.565, -74.217] },
      { name: 'Fusagasugá', coords: [4.345, -74.365] },
      { name: 'Chinauta', coords: [4.244, -74.435] },
      { name: 'Melgar', coords: [4.199, -74.636] },
    ],
    blockagePoints: [
      { name: 'Salida Bogotá (Autopista Sur)', type: 'salida', coords: [4.628, -74.133], capacityReduction: 0.45, description: 'Embudo en salida sur de Bogotá hacia Soacha' },
      { name: 'Peaje Chusacá', type: 'peaje', coords: [4.565, -74.217], capacityReduction: 0.35, description: 'Cuello de botella por casetas de cobro' },
      { name: 'Curvas Fusagasugá', type: 'via', coords: [4.380, -74.340], capacityReduction: 0.25, description: 'Tramo sinuoso de descenso, accidentes frecuentes' },
      { name: 'Peaje Chinauta', type: 'peaje', coords: [4.244, -74.435], capacityReduction: 0.30, description: 'Segundo punto de cobro, acumulación de cola' },
    ],
    color: '#ef4444',
    description: 'Principal corredor turístico al suroccidente. 500,000 vehículos en SS 2025.',
  },
  {
    id: 'bogota-medellin',
    name: 'Bogotá – Medellín',
    route: 'Ruta 60',
    distanceKm: 420,
    normalTravelTimeHrs: 8.5,
    normalCapacityVehHr: 1800,
    freeFlowSpeedKmh: 60,
    region: 'andina',
    criticalPoints: ['Siberia', 'Villeta', 'Guaduas', 'Honda', 'La Manuela'],
    // Calibrado para IRT ~65 sin lluvia
    peakDayVolume: 25000,
    rainProbabilityByDay: [0.35, 0.30, 0.40, 0.45, 0.50, 0.45, 0.50, 0.55],
    rainImpactFactor: 1.30,
    startCoords: [310, 285],
    endCoords: [195, 225],
    waypoints: [[280, 270], [250, 250], [220, 235]],
    geoStart: [4.711, -74.072],   // Bogotá
    geoEnd: [6.251, -75.563],     // Medellín
    geoWaypoints: [
      [4.831, -74.175],  // Siberia
      [5.017, -74.474],  // Villeta
      [5.070, -74.598],  // Guaduas
      [5.208, -74.736],  // Honda
      [5.540, -75.060],  // La Manuela
    ],
    geoCriticalPoints: [
      { name: 'Siberia', coords: [4.831, -74.175] },
      { name: 'Villeta', coords: [5.017, -74.474] },
      { name: 'Guaduas', coords: [5.070, -74.598] },
      { name: 'Honda', coords: [5.208, -74.736] },
      { name: 'La Manuela', coords: [5.540, -75.060] },
    ],
    blockagePoints: [
      { name: 'Salida Bogotá (Calle 80)', type: 'salida', coords: [4.755, -74.120], capacityReduction: 0.40, description: 'Salida noroccidental, embudo urbano' },
      { name: 'Peaje Siberia', type: 'peaje', coords: [4.831, -74.175], capacityReduction: 0.35, description: 'Peaje de alta congestión en éxodo' },
      { name: 'Descenso Villeta', type: 'via', coords: [5.000, -74.450], capacityReduction: 0.30, description: 'Tramo de descenso, vehículos pesados lentos' },
      { name: 'Peaje Honda', type: 'peaje', coords: [5.208, -74.736], capacityReduction: 0.25, description: 'Peaje intermedio del corredor' },
    ],
    color: '#f59e0b',
    description: 'Corredor interurbano principal. 8-9h normales, hasta 14h en SS.',
  },
  {
    id: 'bogota-villavicencio',
    name: 'Bogotá – Villavicencio',
    route: 'Vía al Llano',
    distanceKm: 120,
    normalTravelTimeHrs: 2.5,
    normalCapacityVehHr: 1500,
    freeFlowSpeedKmh: 70,
    region: 'orinoquia',
    criticalPoints: ['Km 18 Chipaque', 'Túnel Renacer', 'Guayabetal', 'Pipiral'],
    // Calibrado para IRT ~88 sin lluvia (cuello de botella severo km 18)
    peakDayVolume: 35000,
    rainProbabilityByDay: [0.35, 0.30, 0.40, 0.45, 0.50, 0.55, 0.50, 0.45],
    rainImpactFactor: 1.40,
    startCoords: [310, 285],
    endCoords: [370, 310],
    waypoints: [[330, 290], [350, 300]],
    geoStart: [4.711, -74.072],   // Bogotá
    geoEnd: [4.142, -73.626],     // Villavicencio
    geoWaypoints: [
      [4.443, -74.045],  // Chipaque
      [4.407, -73.947],  // Cáqueza
      [4.225, -73.812],  // Guayabetal
      [4.175, -73.700],  // Pipiral
    ],
    geoCriticalPoints: [
      { name: 'Km 18 Chipaque', coords: [4.443, -74.045] },
      { name: 'Túnel Renacer', coords: [4.415, -73.980] },
      { name: 'Guayabetal', coords: [4.225, -73.812] },
      { name: 'Pipiral', coords: [4.175, -73.700] },
    ],
    blockagePoints: [
      { name: 'Salida Bogotá (Vía al Llano)', type: 'salida', coords: [4.595, -74.065], capacityReduction: 0.50, description: 'Salida suroriental, embudo severo km 0-5' },
      { name: 'Km 18 Chipaque', type: 'via', coords: [4.443, -74.045], capacityReduction: 0.55, description: 'Paso regulado, máximo cuello de botella nacional' },
      { name: 'Túnel Renacer', type: 'tunel', coords: [4.415, -73.980], capacityReduction: 0.45, description: 'Paso por túnel con control de flujo unidireccional' },
      { name: 'Peaje Pipiral', type: 'peaje', coords: [4.175, -73.700], capacityReduction: 0.30, description: 'Peaje de acceso a Villavicencio' },
    ],
    color: '#8b5cf6',
    description: '+1 millón de viajeros en SS. Cuello de botella severo km 18.',
  },
  {
    id: 'costa-caribe',
    name: 'Santa Marta – Barranquilla – Cartagena',
    route: 'Ruta 90',
    distanceKm: 235,
    normalTravelTimeHrs: 4.5,
    normalCapacityVehHr: 2000,
    freeFlowSpeedKmh: 80,
    region: 'caribe',
    criticalPoints: ['Ciénaga', 'Juan de Acosta', 'Acceso Cartagena', 'Luruaco'],
    // Calibrado para IRT ~70 sin lluvia
    peakDayVolume: 32000,
    rainProbabilityByDay: [0.25, 0.20, 0.25, 0.30, 0.35, 0.30, 0.25, 0.30],
    rainImpactFactor: 1.25,
    startCoords: [240, 115],
    endCoords: [175, 140],
    waypoints: [[220, 125], [200, 130]],
    geoStart: [11.241, -74.199],  // Santa Marta
    geoEnd: [10.391, -75.514],    // Cartagena
    geoWaypoints: [
      [10.967, -74.247],  // Ciénaga
      [10.964, -74.781],  // Barranquilla
      [10.652, -75.041],  // Juan de Acosta
      [10.480, -75.300],  // Luruaco
    ],
    geoCriticalPoints: [
      { name: 'Ciénaga', coords: [10.967, -74.247] },
      { name: 'Barranquilla', coords: [10.964, -74.781] },
      { name: 'Juan de Acosta', coords: [10.652, -75.041] },
      { name: 'Acceso Cartagena', coords: [10.430, -75.450] },
    ],
    blockagePoints: [
      { name: 'Peaje Ciénaga', type: 'peaje', coords: [10.967, -74.247], capacityReduction: 0.30, description: 'Peaje en zona de ciénaga, acceso lento' },
      { name: 'Acceso Barranquilla', type: 'via', coords: [10.960, -74.810], capacityReduction: 0.35, description: 'Travesía urbana de Barranquilla' },
      { name: 'Peaje Juan de Acosta', type: 'peaje', coords: [10.652, -75.041], capacityReduction: 0.25, description: 'Peaje costero intermedio' },
      { name: 'Acceso Cartagena', type: 'salida', coords: [10.430, -75.450], capacityReduction: 0.40, description: 'Embudo de ingreso a Cartagena' },
    ],
    color: '#06b6d4',
    description: 'Corredor turístico costero. Alto volumen por turismo de playa.',
  },
];

/**
 * Calcula el volumen vehicular por hora para un corredor, día y hora específicos.
 * @returns {{ volume: number, dayVolume: number, factorFestivo: number }}
 */
export function getTrafficVolume(corridor, dayIndex, hour, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const dayVolume = Math.round(corridor.peakDayVolume * dayFactor);
  const profile = getCorridorDayProfile(corridor.id, dayIndex, nivelLluvia);
  const hourlyVolume = Math.round(dayVolume * profile[hour]);
  const factorFestivo = getFactorFestivo(dayIndex, hour, corridor.id, nivelLluvia);

  return {
    volume: hourlyVolume,
    dayVolume,
    factorFestivo,
  };
}

/**
 * Obtiene el perfil horario completo (24h) para un corredor y día.
 * Usa perfil específico del corredor, ajustado por clima.
 * @returns {number[]} Array de 24 valores de volumen/hora
 */
export function getHourlyProfile(corridor, dayIndex, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const dayVolume = Math.round(corridor.peakDayVolume * dayFactor);
  const profile = getCorridorDayProfile(corridor.id, dayIndex, nivelLluvia);
  return profile.map(p => Math.round(dayVolume * p));
}

/**
 * Obtiene la probabilidad de lluvia para un corredor en un día específico.
 */
export function getRainProbability(corridor, dayIndex) {
  return corridor.rainProbabilityByDay[dayIndex] || 0.3;
}
