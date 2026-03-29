/**
 * VIITS — Datos de 7 Corredores Viales Nacionales · 33 Peajes INVÍAS
 * Fuentes: INVÍAS ConteosFijosMoviles · ANI · MinTransporte · ANSV · IDEAM
 * Inventario peajes: peajes_act.xlsx — VIITS/INVÍAS 2026
 * Modelo IRT v1.0 — VIITS/INVÍAS · DITRA 2026
 */

// ═══════════════════════════════════════════════════════════════
// PERFILES HORARIOS — Distribución porcentual de volumen diario
// Cada array tiene 24 valores (horas 0-23), suma ≈ 1.0
// Tres tipos: exit (éxodo), return (retorno), normal
// ═══════════════════════════════════════════════════════════════

// C1 — MEDELLÍN–HONDA–BOGOTÁ: Corredor largo (545 km)
// Salidas MUY tempranas (3-5am) para llegar antes de Honda
const C1_EXIT = [
  0.015, 0.018, 0.025, 0.045, 0.070, 0.090,
  0.100, 0.095, 0.082, 0.068, 0.058, 0.050,
  0.048, 0.045, 0.042, 0.040, 0.035, 0.028,
  0.020, 0.015, 0.012, 0.008, 0.005, 0.004
];
const C1_RETURN = [
  0.008, 0.005, 0.005, 0.008, 0.012, 0.018,
  0.035, 0.048, 0.058, 0.065, 0.072, 0.078,
  0.082, 0.088, 0.092, 0.088, 0.080, 0.068,
  0.050, 0.038, 0.028, 0.020, 0.012, 0.008
];
const C1_NORMAL = [
  0.015, 0.012, 0.012, 0.015, 0.022, 0.035,
  0.052, 0.062, 0.068, 0.065, 0.060, 0.058,
  0.055, 0.055, 0.058, 0.062, 0.058, 0.052,
  0.045, 0.038, 0.032, 0.025, 0.020, 0.015
];

// C2 — POPAYÁN–CALI–CARTAGO: Panamericana (340 km)
// Tráfico distribuido, turismo Pacífico
const C2_EXIT = [
  0.010, 0.008, 0.010, 0.015, 0.028, 0.048,
  0.072, 0.088, 0.095, 0.092, 0.082, 0.070,
  0.062, 0.058, 0.055, 0.050, 0.042, 0.035,
  0.028, 0.022, 0.015, 0.012, 0.008, 0.005
];
const C2_RETURN = [
  0.006, 0.005, 0.005, 0.008, 0.012, 0.018,
  0.030, 0.042, 0.055, 0.065, 0.072, 0.078,
  0.085, 0.090, 0.092, 0.088, 0.078, 0.062,
  0.045, 0.032, 0.022, 0.015, 0.010, 0.006
];
const C2_NORMAL = [
  0.012, 0.010, 0.010, 0.012, 0.020, 0.032,
  0.050, 0.062, 0.070, 0.072, 0.068, 0.062,
  0.058, 0.055, 0.058, 0.060, 0.055, 0.048,
  0.040, 0.035, 0.028, 0.022, 0.018, 0.012
];

// C3 — BOGOTÁ–GIRARDOT: Corredor turístico corto (135 km)
// Pico EXPLOSIVO 5-9am Viernes Santo
const C3_EXIT = [
  0.010, 0.008, 0.008, 0.012, 0.025, 0.060,
  0.095, 0.110, 0.105, 0.088, 0.072, 0.058,
  0.055, 0.062, 0.068, 0.058, 0.042, 0.030,
  0.020, 0.015, 0.010, 0.008, 0.005, 0.004
];
const C3_RETURN = [
  0.005, 0.004, 0.004, 0.005, 0.008, 0.012,
  0.020, 0.028, 0.035, 0.045, 0.058, 0.068,
  0.078, 0.088, 0.095, 0.105, 0.098, 0.085,
  0.065, 0.045, 0.025, 0.015, 0.010, 0.006
];
const C3_NORMAL = [
  0.012, 0.008, 0.008, 0.010, 0.018, 0.035,
  0.058, 0.072, 0.078, 0.075, 0.068, 0.060,
  0.055, 0.052, 0.058, 0.065, 0.060, 0.052,
  0.042, 0.035, 0.028, 0.022, 0.018, 0.012
];

// C4 — IBAGUÉ–CAJAMARCA (Túnel La Línea, 65 km)
// Cuello de botella por túnel — capacidad limitada 900 veh/h
// Distribución MUY temprana para evitar cola del túnel
const C4_EXIT = [
  0.012, 0.010, 0.018, 0.035, 0.065, 0.095,
  0.108, 0.105, 0.092, 0.078, 0.065, 0.055,
  0.048, 0.045, 0.042, 0.038, 0.030, 0.022,
  0.015, 0.010, 0.008, 0.005, 0.004, 0.003
];
const C4_RETURN = [
  0.005, 0.004, 0.004, 0.006, 0.010, 0.015,
  0.025, 0.038, 0.052, 0.068, 0.078, 0.085,
  0.092, 0.098, 0.095, 0.088, 0.075, 0.058,
  0.040, 0.028, 0.018, 0.012, 0.008, 0.005
];
const C4_NORMAL = [
  0.012, 0.010, 0.010, 0.015, 0.022, 0.038,
  0.055, 0.068, 0.075, 0.072, 0.065, 0.058,
  0.055, 0.052, 0.058, 0.062, 0.058, 0.050,
  0.042, 0.035, 0.028, 0.022, 0.018, 0.012
];

// C5 — BOGOTÁ–VILLAVICENCIO: Cuello de botella SEVERO (110 km)
// Pico ULTRA concentrado 5-8am — históricamente el MÁS congestionado
const C5_EXIT = [
  0.008, 0.005, 0.005, 0.010, 0.030, 0.075,
  0.115, 0.120, 0.108, 0.085, 0.068, 0.055,
  0.048, 0.042, 0.038, 0.035, 0.028, 0.022,
  0.018, 0.012, 0.008, 0.005, 0.004, 0.003
];
const C5_RETURN = [
  0.004, 0.003, 0.003, 0.004, 0.006, 0.010,
  0.018, 0.025, 0.035, 0.050, 0.065, 0.078,
  0.092, 0.100, 0.108, 0.112, 0.100, 0.082,
  0.055, 0.035, 0.020, 0.012, 0.008, 0.005
];
const C5_NORMAL = [
  0.015, 0.010, 0.010, 0.012, 0.020, 0.038,
  0.060, 0.075, 0.080, 0.072, 0.065, 0.058,
  0.055, 0.050, 0.055, 0.060, 0.055, 0.048,
  0.040, 0.032, 0.025, 0.020, 0.015, 0.012
];

// C6 — BOGOTÁ–TUNJA: Turismo religioso Boyacá (150 km)
// Distribución más suave, turismo cultural
const C6_EXIT = [
  0.008, 0.006, 0.008, 0.012, 0.022, 0.048,
  0.078, 0.092, 0.098, 0.095, 0.085, 0.072,
  0.062, 0.058, 0.055, 0.050, 0.042, 0.035,
  0.025, 0.018, 0.012, 0.008, 0.006, 0.005
];
const C6_RETURN = [
  0.005, 0.004, 0.004, 0.005, 0.008, 0.012,
  0.022, 0.032, 0.042, 0.055, 0.068, 0.078,
  0.085, 0.092, 0.098, 0.095, 0.085, 0.072,
  0.052, 0.038, 0.025, 0.015, 0.008, 0.005
];
const C6_NORMAL = [
  0.012, 0.010, 0.010, 0.012, 0.020, 0.035,
  0.055, 0.065, 0.072, 0.070, 0.065, 0.058,
  0.055, 0.052, 0.058, 0.062, 0.058, 0.050,
  0.042, 0.035, 0.028, 0.022, 0.018, 0.012
];

// C7 — SANTA MARTA–BARRANQUILLA: Turismo de playa (95 km)
// Pico tardío 9-1pm (turistas no madrugan), actividad nocturna
const C7_EXIT = [
  0.012, 0.010, 0.010, 0.012, 0.018, 0.028,
  0.042, 0.058, 0.075, 0.092, 0.098, 0.095,
  0.088, 0.078, 0.068, 0.058, 0.050, 0.042,
  0.035, 0.030, 0.025, 0.022, 0.018, 0.015
];
const C7_RETURN = [
  0.012, 0.010, 0.008, 0.008, 0.010, 0.015,
  0.025, 0.035, 0.048, 0.058, 0.068, 0.075,
  0.085, 0.092, 0.095, 0.090, 0.082, 0.068,
  0.048, 0.035, 0.025, 0.018, 0.015, 0.012
];
const C7_NORMAL = [
  0.018, 0.015, 0.012, 0.015, 0.020, 0.028,
  0.042, 0.055, 0.065, 0.072, 0.075, 0.072,
  0.068, 0.062, 0.058, 0.058, 0.055, 0.050,
  0.042, 0.038, 0.032, 0.028, 0.022, 0.018
];

// ═══════════════════════════════════════════════════════════════
// DÍAS SEMANA SANTA 2026
// ═══════════════════════════════════════════════════════════════
export const DAYS = [
  { index: 0, date: '28 Mar', name: 'Viernes — Inicio Éxodo', short: 'Vie 28', isHighlight: true,  phase: 'exodo' },
  { index: 1, date: '29 Mar', name: 'Domingo de Ramos',       short: 'Dom 29', isHighlight: false, phase: 'exodo' },
  { index: 2, date: '30 Mar', name: 'Lunes Santo',            short: 'Lun 30', isHighlight: false, phase: 'exodo' },
  { index: 3, date: '31 Mar', name: 'Martes Santo',           short: 'Mar 31', isHighlight: false, phase: 'exodo' },
  { index: 4, date: '1 Abr',  name: 'Miércoles Santo',       short: 'Mié 1',  isHighlight: true,  phase: 'exodo' },
  { index: 5, date: '2 Abr',  name: 'Jueves Santo',          short: 'Jue 2',  isHighlight: true,  phase: 'exodo' },
  { index: 6, date: '3 Abr',  name: 'Viernes Santo',         short: 'Vie 3',  isHighlight: true,  phase: 'exodo' },
  { index: 7, date: '4 Abr',  name: 'Sábado de Gloria',      short: 'Sáb 4',  isHighlight: true,  phase: 'retorno' },
  { index: 8, date: '5 Abr',  name: 'Domingo de Resurrección', short: 'Dom 5', isHighlight: true,  phase: 'retorno' },
];

// Fases operativas DITRA
export const OPERATION_PHASES = {
  'exodo':     { label: 'Operación Éxodo',     color: '#ef4444', description: 'Salida masiva — 70% casetas salida · 30% retorno · Restricción carga ≥3.4t' },
  'retorno':   { label: 'Operación Retorno',   color: '#3b82f6', description: 'Retorno masivo a ciudades — picos 12PM-8PM' },
};

// Factor de volumen por día (normalizado, Viernes Santo = 1.0)
// Fuente: MinTransporte distribución porcentual SS 2019-2025
// Índice 0 = Vie 28 Mar (inicio éxodo), último = Dom 5 Abr (retorno)
const DAY_VOLUME_FACTORS = [0.55, 0.43, 0.29, 0.33, 0.52, 0.71, 1.00, 0.81, 0.64];

// Tipo de día operativo DITRA: 3 fases
// Éxodo: salida masiva (Vie 28 Mar - Vie 3 Abr), perfil exit
// Retorno: regreso a ciudades (Sáb-Dom), perfil return con picos 12PM-8PM
const DAY_TYPES = [
  'exit',    // Vie 28 — Éxodo: inicio oficial, restricción carga 15-22h
  'exit',    // Dom Ramos — Éxodo: salidas anticipadas
  'exit',    // Lunes Santo — Éxodo: flujo creciente
  'exit',    // Martes Santo — Éxodo: acumulación
  'exit',    // Miércoles Santo — Éxodo: salida masiva inicia
  'exit',    // Jueves Santo — Éxodo: pico máximo salida
  'exit',    // Viernes Santo — Éxodo: segundo pico salida
  'return',  // Sábado Gloria — Retorno: inicio retorno progresivo
  'return',  // Domingo Resurrección — Retorno: pico máximo retorno
];

// Perfiles horarios por corredor
const PROFILES = {
  C1: { exit: C1_EXIT, return: C1_RETURN, normal: C1_NORMAL },
  C2: { exit: C2_EXIT, return: C2_RETURN, normal: C2_NORMAL },
  C3: { exit: C3_EXIT, return: C3_RETURN, normal: C3_NORMAL },
  C4: { exit: C4_EXIT, return: C4_RETURN, normal: C4_NORMAL },
  C5: { exit: C5_EXIT, return: C5_RETURN, normal: C5_NORMAL },
  C6: { exit: C6_EXIT, return: C6_RETURN, normal: C6_NORMAL },
  C7: { exit: C7_EXIT, return: C7_RETURN, normal: C7_NORMAL },
};

// ═══════════════════════════════════════════════════════════════
// CLIMA — Factor de sensibilidad regional
// Fuente: IDEAM patrones regionales, FHWA lluvia/tráfico
// ═══════════════════════════════════════════════════════════════
const REGION_RAIN_SENSITIVITY = {
  andina:    1.00,  // Máxima: montaña, curvas, niebla, deslizamientos
  pacifica:  0.90,  // Alta: precipitación intensa en Valle
  orinoquia: 0.85,  // Alta: paso montaña + descenso al llano
  caribe:    0.25,  // Baja: zona seca en Semana Santa
};

function applyWeatherToProfile(baseProfile, nivelLluvia, region) {
  if (nivelLluvia === 0) return baseProfile;
  const sensitivity = REGION_RAIN_SENSITIVITY[region] || 0.5;
  const maxVal = Math.max(...baseProfile);
  const adjusted = [...baseProfile];

  const peakReduction = nivelLluvia === 1 ? 0.12 * sensitivity : 0.28 * sensitivity;
  const redistributionRate = nivelLluvia === 1 ? 0.40 : 0.35;
  const overallReduction = nivelLluvia === 1 ? 0.05 * sensitivity : 0.12 * sensitivity;

  for (let h = 0; h < 24; h++) {
    const relH = baseProfile[h] / maxVal;
    if (relH > 0.7) {
      const red = baseProfile[h] * peakReduction;
      adjusted[h] -= red;
      const rdist = red * redistributionRate;
      if (h > 0) adjusted[h-1] += rdist * 0.25;
      if (h < 23) adjusted[h+1] += rdist * 0.25;
      if (h > 1) adjusted[h-2] += rdist * 0.15;
      if (h < 22) adjusted[h+2] += rdist * 0.15;
    } else if (relH > 0.4) {
      adjusted[h] -= baseProfile[h] * (peakReduction * 0.4);
    }
    adjusted[h] *= (1 - overallReduction);
  }

  if (nivelLluvia === 2 && sensitivity > 0.5) {
    for (let h = 0; h < 5; h++) adjusted[h] *= (1 - 0.30 * sensitivity);
  }

  for (let h = 0; h < 24; h++) adjusted[h] = Math.max(adjusted[h], 0.002);
  return adjusted;
}

// ═══════════════════════════════════════════════════════════════
// COLORES POR CORREDOR (consistentes en todo el sistema)
// ═══════════════════════════════════════════════════════════════
export const CORRIDOR_COLORS = {
  C1: '#38bdf8',  // Cian      — Medellín-Bogotá
  C2: '#a78bfa',  // Violeta   — Popayán-Cartago
  C3: '#fb923c',  // Naranja   — Bogotá-Girardot
  C4: '#34d399',  // Esmeralda — Ibagué-Cajamarca
  C5: '#f472b6',  // Rosa      — Bogotá-Villavicencio
  C6: '#facc15',  // Amarillo  — Bogotá-Tunja
  C7: '#60a5fa',  // Azul      — Santa Marta-Barranquilla
};

// ═══════════════════════════════════════════════════════════════
// 7 CORREDORES · 33 PEAJES INVÍAS
// Fuente: peajes_act.xlsx — VIITS/INVÍAS 2026
// ═══════════════════════════════════════════════════════════════
export const CORRIDORS = [
  {
    id: 'C1',
    name: 'Medellín – Honda – Bogotá',
    shortName: 'Med–Bog',
    route: 'Ruta 60 / Ruta 62',
    distanceKm: 545,
    normalTravelTimeHrs: 8.5,
    peakTravelTimeHrs: 14,
    normalCapacityVehHr: 1800,
    freeFlowSpeedKmh: 80,
    region: 'andina',
    color: CORRIDOR_COLORS.C1,
    peakDayVolume: 28000,
    incrementoVsSemNormal: 3.2,
    mixVehicular: { livianos: 0.72, buses: 0.18, camiones: 0.10 },
    rainProbByDay: [0.30, 0.35, 0.30, 0.40, 0.45, 0.50, 0.45, 0.50, 0.55],
    departamentos: ['Antioquia', 'Tolima', 'Cundinamarca'],
    geoStart: { lat: 6.2476, lng: -75.5658, nombre: 'Medellín' },
    geoEnd:   { lat: 4.7110, lng: -74.0721, nombre: 'Bogotá' },
    peajes: [
      { id:'C1-01', nombre:'NIQUÍA',        lat:6.345101, lng:-75.526596, km:'KM 20',  critico:false },
      { id:'C1-02', nombre:'GUARNE',         lat:6.327898, lng:-75.515533, km:'KM 28',  critico:false },
      { id:'C1-03', nombre:'TRAPICHE',       lat:6.399637, lng:-75.433016, km:'KM 45',  critico:false },
      { id:'C1-04', nombre:'PANDEQUESO',     lat:6.477998, lng:-75.378610, km:'KM 58',  critico:false },
      { id:'C1-05', nombre:'CISNEROS',       lat:6.536330, lng:-75.074777, km:'KM 95',  critico:false },
      { id:'C1-06', nombre:'PUERTO BERRÍO',  lat:6.496650, lng:-74.501381, km:'KM 165', critico:false },
      { id:'C1-07', nombre:'HONDA',          lat:5.201507, lng:-74.820282, km:'KM 280', critico:true  },
      { id:'C1-08', nombre:'SIBERIA',        lat:4.780360, lng:-74.185028, km:'KM 480', critico:false },
    ],
    description: 'Corredor interurbano principal. Honda es cuello de botella histórico.',
  },
  {
    id: 'C2',
    name: 'Popayán – Cali – Cartago',
    shortName: 'Pop–Car',
    route: 'Ruta 25 / Panamericana',
    distanceKm: 340,
    normalTravelTimeHrs: 5.0,
    peakTravelTimeHrs: 9,
    normalCapacityVehHr: 2400,
    freeFlowSpeedKmh: 85,
    region: 'pacifica',
    color: CORRIDOR_COLORS.C2,
    peakDayVolume: 30000,
    incrementoVsSemNormal: 2.8,
    mixVehicular: { livianos: 0.75, buses: 0.18, camiones: 0.07 },
    rainProbByDay: [0.45, 0.50, 0.45, 0.55, 0.60, 0.55, 0.50, 0.45, 0.50],
    departamentos: ['Cauca', 'Valle del Cauca', 'Risaralda'],
    geoStart: { lat: 2.4448, lng: -76.6147, nombre: 'Popayán' },
    geoEnd:   { lat: 4.7488, lng: -75.9142, nombre: 'Cartago' },
    peajes: [
      { id:'C2-01', nombre:'EL BORDO',    lat:2.188949, lng:-76.851165, km:'KM 40',  critico:false },
      { id:'C2-02', nombre:'VILLARICA',   lat:3.151233, lng:-76.460045, km:'KM 85',  critico:false },
      { id:'C2-03', nombre:'CENCAR',      lat:3.557383, lng:-76.462683, km:'KM 135', critico:false },
      { id:'C2-04', nombre:'CERRITO',     lat:3.713096, lng:-76.319180, km:'KM 175', critico:false },
      { id:'C2-05', nombre:'MEDIACANOA',  lat:3.759986, lng:-76.411322, km:'KM 210', critico:false },
      { id:'C2-06', nombre:'LA URIBE',    lat:4.252468, lng:-76.118438, km:'KM 265', critico:false },
      { id:'C2-07', nombre:'COROZAL',     lat:4.407960, lng:-75.899872, km:'KM 300', critico:false },
      { id:'C2-08', nombre:'CERRITOS II', lat:4.793408, lng:-75.859963, km:'KM 340', critico:false },
    ],
    description: 'Panamericana. Turismo Pacífico y Valle del Cauca.',
  },
  {
    id: 'C3',
    name: 'Bogotá – Girardot',
    shortName: 'Bog–Gir',
    route: 'Ruta 40 / Autopista Sur',
    distanceKm: 135,
    normalTravelTimeHrs: 2.5,
    peakTravelTimeHrs: 7,
    normalCapacityVehHr: 2200,
    freeFlowSpeedKmh: 85,
    region: 'andina',
    color: CORRIDOR_COLORS.C3,
    peakDayVolume: 42000,
    incrementoVsSemNormal: 4.2,
    mixVehicular: { livianos: 0.78, buses: 0.18, camiones: 0.04 },
    rainProbByDay: [0.25, 0.30, 0.25, 0.35, 0.45, 0.50, 0.40, 0.25, 0.20],
    departamentos: ['Cundinamarca', 'Tolima'],
    geoStart: { lat: 4.7110, lng: -74.0721, nombre: 'Bogotá' },
    geoEnd:   { lat: 4.3033, lng: -74.7986, nombre: 'Girardot' },
    peajes: [
      { id:'C3-01', nombre:'CHUSACÁ',  lat:4.547766, lng:-74.271805, km:'KM 14',  critico:true  },
      { id:'C3-02', nombre:'CHINAUTA', lat:4.269378, lng:-74.500107, km:'KM 68',  critico:true  },
      { id:'C3-03', nombre:'PUBENZA',  lat:4.403316, lng:-74.731464, km:'KM 100', critico:false },
      { id:'C3-04', nombre:'FLANDES',  lat:4.192173, lng:-74.861153, km:'KM 130', critico:false },
    ],
    description: 'Corredor turístico #1 desde Bogotá. 500,000+ vehículos en SS.',
  },
  {
    id: 'C4',
    name: 'Ibagué – Cajamarca (La Línea)',
    shortName: 'Ibg–Caj',
    route: 'Ruta 40 / Túnel La Línea',
    distanceKm: 65,
    normalTravelTimeHrs: 1.5,
    peakTravelTimeHrs: 5,
    normalCapacityVehHr: 900,
    freeFlowSpeedKmh: 60,
    region: 'andina',
    color: CORRIDOR_COLORS.C4,
    peakDayVolume: 12000,
    incrementoVsSemNormal: 3.5,
    mixVehicular: { livianos: 0.68, buses: 0.24, camiones: 0.08 },
    rainProbByDay: [0.35, 0.40, 0.35, 0.45, 0.50, 0.55, 0.45, 0.40, 0.45],
    departamentos: ['Tolima', 'Quindío'],
    geoStart: { lat: 4.4389, lng: -75.2322, nombre: 'Ibagué' },
    geoEnd:   { lat: 4.4396, lng: -75.4299, nombre: 'Cajamarca' },
    peajes: [
      { id:'C4-01', nombre:'GUALANDAY',               lat:4.300429, lng:-75.050087, km:'KM 15', critico:false },
      { id:'C4-02', nombre:'TÚNEL LA LÍNEA (TOLIMA)',  lat:4.445527, lng:-75.518799, km:'KM 48', critico:true  },
      { id:'C4-03', nombre:'TÚNEL LA LÍNEA (QUINDÍO)', lat:4.523458, lng:-75.589381, km:'KM 53', critico:true  },
    ],
    description: 'Cuello de botella del túnel. Capacidad limitada 900 veh/h.',
  },
  {
    id: 'C5',
    name: 'Bogotá – Villavicencio',
    shortName: 'Bog–Vll',
    route: 'Ruta 40 / Autopista al Llano',
    distanceKm: 110,
    normalTravelTimeHrs: 2.5,
    peakTravelTimeHrs: 10,
    normalCapacityVehHr: 1600,
    freeFlowSpeedKmh: 70,
    region: 'orinoquia',
    color: CORRIDOR_COLORS.C5,
    peakDayVolume: 38000,
    incrementoVsSemNormal: 4.8,
    mixVehicular: { livianos: 0.80, buses: 0.16, camiones: 0.04 },
    rainProbByDay: [0.30, 0.35, 0.30, 0.40, 0.45, 0.50, 0.55, 0.50, 0.45],
    departamentos: ['Cundinamarca', 'Meta'],
    geoStart: { lat: 4.7110, lng: -74.0721, nombre: 'Bogotá' },
    geoEnd:   { lat: 4.1420, lng: -73.6266, nombre: 'Villavicencio' },
    peajes: [
      { id:'C5-01', nombre:'NARANJAL',    lat:4.285107, lng:-73.834808, km:'KM 38',  critico:false },
      { id:'C5-02', nombre:'PIPIRAL',     lat:4.201095, lng:-73.721420, km:'KM 68',  critico:true  },
      { id:'C5-03', nombre:'OCOA',        lat:4.026246, lng:-73.775192, km:'KM 88',  critico:false },
      { id:'C5-04', nombre:'LA LIBERTAD', lat:4.056860, lng:-73.463287, km:'KM 108', critico:false },
    ],
    description: 'Mayor congestión histórica de Colombia en SS. +1M viajeros.',
  },
  {
    id: 'C6',
    name: 'Bogotá – Tunja',
    shortName: 'Bog–Tun',
    route: 'Ruta 55 / Autopista Norte',
    distanceKm: 150,
    normalTravelTimeHrs: 2.5,
    peakTravelTimeHrs: 6,
    normalCapacityVehHr: 2600,
    freeFlowSpeedKmh: 90,
    region: 'andina',
    color: CORRIDOR_COLORS.C6,
    peakDayVolume: 35000,
    incrementoVsSemNormal: 3.8,
    mixVehicular: { livianos: 0.78, buses: 0.18, camiones: 0.04 },
    rainProbByDay: [0.25, 0.30, 0.25, 0.35, 0.40, 0.45, 0.40, 0.35, 0.30],
    departamentos: ['Cundinamarca', 'Boyacá'],
    geoStart: { lat: 4.7110, lng: -74.0721, nombre: 'Bogotá' },
    geoEnd:   { lat: 5.5353, lng: -73.3678, nombre: 'Tunja' },
    peajes: [
      { id:'C6-01', nombre:'ANDES',      lat:4.822679, lng:-74.033081, km:'KM 18',  critico:false },
      { id:'C6-02', nombre:'EL ROBLE',   lat:5.031299, lng:-73.839882, km:'KM 62',  critico:true  },
      { id:'C6-03', nombre:'ALBARRACÍN', lat:5.290461, lng:-73.583504, km:'KM 110', critico:false },
      { id:'C6-04', nombre:'TUTA',       lat:5.656897, lng:-73.278435, km:'KM 145', critico:false },
    ],
    description: 'Turismo religioso a Boyacá. Villa de Leyva, Ráquira.',
  },
  {
    id: 'C7',
    name: 'Santa Marta – Barranquilla',
    shortName: 'SMa–Baq',
    route: 'Ruta 90 / Troncal del Caribe',
    distanceKm: 95,
    normalTravelTimeHrs: 2.0,
    peakTravelTimeHrs: 5,
    normalCapacityVehHr: 2800,
    freeFlowSpeedKmh: 90,
    region: 'caribe',
    color: CORRIDOR_COLORS.C7,
    peakDayVolume: 34000,
    incrementoVsSemNormal: 3.0,
    mixVehicular: { livianos: 0.82, buses: 0.15, camiones: 0.03 },
    rainProbByDay: [0.10, 0.15, 0.10, 0.15, 0.20, 0.20, 0.15, 0.10, 0.15],
    departamentos: ['Magdalena', 'Atlántico'],
    geoStart: { lat: 11.2408, lng: -74.2110, nombre: 'Santa Marta' },
    geoEnd:   { lat: 10.9639, lng: -74.7964, nombre: 'Barranquilla' },
    peajes: [
      { id:'C7-01', nombre:'NEGUANJE',       lat:11.253129, lng:-74.109322, km:'KM 12', critico:false },
      { id:'C7-02', nombre:'TUCUNICA',       lat:10.608947, lng:-74.168495, km:'KM 40', critico:false },
      { id:'C7-03', nombre:'TASAJERA',       lat:10.977188, lng:-74.336664, km:'KM 52', critico:true  },
      { id:'C7-04', nombre:'LAUREANO GÓMEZ', lat:10.978719, lng:-74.729719, km:'KM 68', critico:false },
      { id:'C7-05', nombre:'SABANAGRANDE',   lat:10.799582, lng:-74.759003, km:'KM 75', critico:false },
      { id:'C7-06', nombre:'GALAPA',         lat:10.837545, lng:-74.902122, km:'KM 88', critico:false },
    ],
    description: 'Corredor turístico costero. Caribe seco en SS.',
  },
];

// Total de peajes
export const TOTAL_TOLL_STATIONS = CORRIDORS.reduce((s, c) => s + c.peajes.length, 0);

// Todos los peajes flat
export const ALL_TOLL_STATIONS = CORRIDORS.flatMap(c =>
  c.peajes.map(p => ({ ...p, corridorId: c.id, corridorColor: c.color, corridorName: c.name }))
);

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE VOLUMEN Y PERFIL
// ═══════════════════════════════════════════════════════════════

function getCorridorDayProfileBase(corridorId, dayIndex) {
  const p = PROFILES[corridorId];
  if (!p) return C3_EXIT;
  const dayType = DAY_TYPES[dayIndex];
  return p[dayType] || p.normal;
}

function getCorridorDayProfile(corridorId, dayIndex, nivelLluvia) {
  const base = getCorridorDayProfileBase(corridorId, dayIndex);
  if (!nivelLluvia || nivelLluvia === 0) return base;
  const corridor = CORRIDORS.find(c => c.id === corridorId);
  const region = corridor?.region || 'andina';
  return applyWeatherToProfile(base, nivelLluvia, region);
}

function getFactorFestivo(dayIndex, hour, corridorId, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const profile = getCorridorDayProfile(corridorId, dayIndex, nivelLluvia);
  const hourFactor = profile[hour] / Math.max(...profile);
  const isActive = hour >= 6 && hour <= 21;
  return dayFactor * (isActive ? Math.max(hourFactor, 0.4) : hourFactor);
}

export function getTrafficVolume(corridor, dayIndex, hour, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const dayVolume = Math.round(corridor.peakDayVolume * dayFactor);
  const profile = getCorridorDayProfile(corridor.id, dayIndex, nivelLluvia);
  const volume = Math.round(dayVolume * profile[hour]);
  const factorFestivo = getFactorFestivo(dayIndex, hour, corridor.id, nivelLluvia);
  return { volume, dayVolume, factorFestivo };
}

export function getHourlyProfile(corridor, dayIndex, nivelLluvia) {
  const dayFactor = DAY_VOLUME_FACTORS[dayIndex];
  const dayVolume = Math.round(corridor.peakDayVolume * dayFactor);
  const profile = getCorridorDayProfile(corridor.id, dayIndex, nivelLluvia);
  return profile.map(p => Math.round(dayVolume * p));
}

export function getRainProbability(corridor, dayIndex) {
  return corridor.rainProbByDay?.[dayIndex] || 0.3;
}
