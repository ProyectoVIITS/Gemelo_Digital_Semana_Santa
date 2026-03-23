/**
 * VIITS NEXUS — Datos Maestros de 7 Corredores y 33 Peajes
 * Fuente: Inventario oficial INVÍAS (peajes_act.xlsx)
 * Versión: Monitor Semana Santa 2026 — DITRA
 */

// ─── COLORES POR CORREDOR ───────────────────────────────────
export const CORRIDOR_COLORS = {
  C1: '#38bdf8',   // Azul cian    — Medellín-Bogotá
  C2: '#a78bfa',   // Violeta      — Popayán-Cartago
  C3: '#fb923c',   // Naranja      — Bogotá-Girardot
  C4: '#34d399',   // Verde esmeralda — Ibagué-Cajamarca
  C5: '#f472b6',   // Rosa         — Bogotá-Villavicencio
  C6: '#facc15',   // Amarillo     — Bogotá-Tunja
  C7: '#60a5fa',   // Azul medio   — Santa Marta-Barranquilla
};

// ─── IRT THRESHOLDS ─────────────────────────────────────────
export const IRT_THRESHOLDS = {
  normal:    { max: 30,  label: 'NORMAL',        color: '#22c55e' },
  moderate:  { max: 55,  label: 'MODERADO',      color: '#84cc16' },
  congested: { max: 75,  label: 'CONGESTIONADO', color: '#f59e0b' },
  critical:  { max: 90,  label: 'CRÍTICO',       color: '#ef4444' },
  closed:    { max: 100, label: 'CERRADO',       color: '#7f1d1d' },
};

export function getIRTLevel(irt) {
  if (irt <= 30) return IRT_THRESHOLDS.normal;
  if (irt <= 55) return IRT_THRESHOLDS.moderate;
  if (irt <= 75) return IRT_THRESHOLDS.congested;
  if (irt <= 90) return IRT_THRESHOLDS.critical;
  return IRT_THRESHOLDS.closed;
}

/**
 * Fórmula IRT oficial DITRA:
 * IRT = (1 - speed/speedLimit) * 40 + (flow/600) * 35 + (queue/10) * 25
 */
export function computeIRT(speed, flow, queue, speedLimit = 80) {
  const speedComponent = (1 - Math.min(speed, speedLimit) / speedLimit) * 40;
  const flowComponent = Math.min(flow / 600, 1) * 35;
  const queueComponent = Math.min(queue / 10, 1) * 25;
  return Math.round(Math.max(0, Math.min(100, speedComponent + flowComponent + queueComponent)));
}

// Peajes con historial de mayor congestión en Semana Santa
export const HIGH_RISK_TOLLS = [
  'C1-07', // HONDA
  'C3-01', // CHUSACÁ
  'C3-02', // CHINAUTA
  'C4-02', // LÍNEA TOLIMA
  'C5-02', // PIPIRAL
  'C6-02', // EL ROBLE
];

// Peaje representativo por corredor (para vista mini)
export const REPRESENTATIVE_TOLLS = {
  C1: 'C1-07', // HONDA
  C2: 'C2-04', // CERRITO
  C3: 'C3-01', // CHUSACÁ
  C4: 'C4-02', // TÚNEL LA LÍNEA TOLIMA
  C5: 'C5-02', // PIPIRAL
  C6: 'C6-02', // EL ROBLE
  C7: 'C7-03', // TASAJERA
};

// ─── 7 CORREDORES CON 33 PEAJES ─────────────────────────────
export const NEXUS_CORRIDORS = [

  // ══ C1 — MEDELLÍN · RIONEGRO · DORADAL · HONDA · BOGOTÁ ══
  {
    id: 'C1',
    name: 'Medellín – Honda – Bogotá',
    shortName: 'Med–Bogotá',
    route: 'Ruta 60 / Ruta 62',
    distanceKm: 545,
    waypoints: ['Medellín', 'Rionegro', 'Doradal', 'Puerto Berrío', 'Honda', 'Bogotá'],
    color: '#38bdf8',
    speedLimit: 80,
    departments: ['Antioquia', 'Tolima', 'Cundinamarca'],
    svgPath: 'M 155 245 Q 160 230 168 220 Q 175 215 200 248',
    tollStations: [
      { id: 'C1-01', name: 'NIQUÍA', lat: 6.345101, lng: -75.526596, km: 'KM 20', sector: 'MEDELLÍN - HOYO RICO', type: 'INVIAS', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 5, retorno: 1 } },
      { id: 'C1-02', name: 'GUARNE', lat: 6.327898, lng: -75.515533, km: 'KM 28', sector: 'MEDELLÍN - SANTUARIO', type: 'DEVIMED', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 8, salida: 6, retorno: 2 } },
      { id: 'C1-03', name: 'TRAPICHE', lat: 6.399637, lng: -75.433016, km: 'KM 45', sector: 'MEDELLÍN - HOYO RICO', type: 'INVIAS', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C1-04', name: 'PANDEQUESO', lat: 6.477998, lng: -75.378610, km: 'KM 58', sector: 'MEDELLÍN - HOYO RICO', type: 'INVIAS', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C1-05', name: 'CISNEROS', lat: 6.536330, lng: -75.074777, km: 'KM 95', sector: 'CISNEROS - ALTO DE DOLORES', type: 'VÍAS DEL NUS', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C1-06', name: 'PUERTO BERRÍO', lat: 6.496650, lng: -74.501381, km: 'KM 165', sector: 'CISNEROS - PUERTO BERRÍO', type: 'VÍAS DEL NUS', department: 'Antioquia', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C1-07', name: 'HONDA', lat: 5.201507, lng: -74.820282, km: 'KM 280', sector: 'FRESNO - HONDA', type: 'INVIAS', department: 'Tolima', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C1-08', name: 'SIBERIA', lat: 4.780360, lng: -74.185028, km: 'KM 480', sector: 'VILLETA - BOGOTÁ', type: 'CONCESIÓN SABANA', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 8, salida: 6, retorno: 2 } },
    ],
  },

  // ══ C2 — POPAYÁN · CALI · BUGA · LA PAILA · CARTAGO ══
  {
    id: 'C2',
    name: 'Popayán – Cali – Cartago',
    shortName: 'Pop–Cartago',
    route: 'Ruta 25 / Panamericana',
    distanceKm: 340,
    waypoints: ['Popayán', 'Cali', 'Palmira', 'Buga', 'La Paila', 'Cartago'],
    color: '#a78bfa',
    speedLimit: 80,
    departments: ['Cauca', 'Valle del Cauca'],
    svgPath: 'M 128 310 Q 130 295 132 278 Q 134 265 138 252',
    tollStations: [
      { id: 'C2-01', name: 'EL BORDO', lat: 2.188949, lng: -76.851165, km: 'KM 40', sector: 'MOJARRAS - POPAYÁN', type: 'INVIAS', department: 'Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C2-02', name: 'VILLARICA', lat: 3.151233, lng: -76.460045, km: 'KM 85', sector: 'POPAYÁN - JAMUNDÍ', type: 'INVIAS', department: 'Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C2-03', name: 'CENCAR', lat: 3.557383, lng: -76.462683, km: 'KM 135', sector: 'CALI - YUMBO', type: 'RUTAS DEL VALLE', department: 'Valle del Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C2-04', name: 'CERRITO', lat: 3.713096, lng: -76.319180, km: 'KM 175', sector: 'CALI - PALMIRA - BUGA', type: 'RUTAS DEL VALLE', department: 'Valle del Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C2-05', name: 'MEDIACANOA', lat: 3.759986, lng: -76.411322, km: 'KM 210', sector: 'YUMBO - MEDIACANOA', type: 'RUTAS DEL VALLE', department: 'Valle del Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C2-06', name: 'LA URIBE', lat: 4.252468, lng: -76.118438, km: 'KM 265', sector: 'ANDALUCÍA - LA PAILA - LA VICTORIA', type: 'INVIAS', department: 'Valle del Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C2-07', name: 'COROZAL', lat: 4.407960, lng: -75.899872, km: 'KM 300', sector: 'LA PAILA - CLUB CAMPESTRE', type: 'INVIAS', department: 'Valle del Cauca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C2-08', name: 'CERRITOS II', lat: 4.793408, lng: -75.859963, km: 'KM 340', sector: 'LA VICTORIA - CARTAGO - CERRITOS', type: 'INVIAS', department: 'Risaralda', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
    ],
  },

  // ══ C3 — BOGOTÁ · GIRARDOT ══
  {
    id: 'C3',
    name: 'Bogotá – Girardot',
    shortName: 'Bog–Girardot',
    route: 'Ruta 40 / Autopista Sur',
    distanceKm: 135,
    waypoints: ['Bogotá', 'Soacha', 'Sibaté', 'Fusagasugá', 'Chinauta', 'Girardot'],
    color: '#fb923c',
    speedLimit: 80,
    departments: ['Cundinamarca', 'Tolima'],
    svgPath: 'M 192 248 Q 188 258 184 268 Q 180 278 176 285',
    tollStations: [
      { id: 'C3-01', name: 'CHUSACÁ', lat: 4.537553, lng: -74.272106, km: 'KM 14', sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', type: 'VÍA SUMAPAZ', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, isCritical: true, boothConfig: { total: 10, salida: 9, retorno: 1 }, streetViewUrl: 'https://www.google.com/maps/embed/v1/streetview?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&location=4.537553,-74.272106&heading=30&pitch=0&fov=90' },
      { id: 'C3-02', name: 'CHINAUTA', lat: 4.269378, lng: -74.500107, km: 'KM 68', sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', type: 'VÍA SUMAPAZ', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, isCritical: true, boothConfig: { total: 10, salida: 9, retorno: 1 } },
      { id: 'C3-03', name: 'PUBENZA', lat: 4.403316, lng: -74.731464, km: 'KM 100', sector: 'GIRARDOT - TOCAIMA', type: 'INVIAS', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C3-04', name: 'FLANDES', lat: 4.192173, lng: -74.861153, km: 'KM 130', sector: 'EL ESPINAL - GIRARDOT', type: 'INVIAS', department: 'Tolima', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
    ],
  },

  // ══ C4 — IBAGUÉ · CAJAMARCA (La Línea) ══
  {
    id: 'C4',
    name: 'Ibagué – La Línea – Cajamarca',
    shortName: 'Ibagué–Cajamarca',
    route: 'Ruta 40 / Túnel La Línea',
    distanceKm: 65,
    waypoints: ['Ibagué', 'Cajamarca', 'Túnel La Línea'],
    color: '#34d399',
    speedLimit: 60,
    departments: ['Tolima', 'Quindío'],
    svgPath: 'M 168 270 Q 162 268 155 265',
    tollStations: [
      { id: 'C4-01', name: 'GUALANDAY', lat: 4.300429, lng: -75.050087, km: 'KM 15', sector: 'IBAGUÉ - CRUCE RUTA 45 (ESPINAL)', type: 'INVIAS', department: 'Tolima', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C4-02', name: 'TÚNEL LA LÍNEA (TOLIMA)', lat: 4.445527, lng: -75.518799, km: 'KM 48', sector: 'LA LÍNEA - CAJAMARCA', type: 'INVIAS', department: 'Tolima', speedLimit: 60, weightLimit: 32, isCritical: true, boothConfig: { total: 3, salida: 2, retorno: 1 } },
      { id: 'C4-03', name: 'TÚNEL LA LÍNEA (QUINDÍO)', lat: 4.523458, lng: -75.589381, km: 'KM 53', sector: 'ARMENIA - LA LÍNEA', type: 'INVIAS', department: 'Quindío', speedLimit: 60, weightLimit: 32, isCritical: true, boothConfig: { total: 3, salida: 2, retorno: 1 } },
    ],
  },

  // ══ C5 — BOGOTÁ · VILLAVICENCIO ══
  {
    id: 'C5',
    name: 'Bogotá – Villavicencio',
    shortName: 'Bog–Villavicencio',
    route: 'Ruta 40 / Autopista al Llano',
    distanceKm: 110,
    waypoints: ['Bogotá', 'El Cáqueza', 'Puente Quetame', 'Pipiral', 'Villavicencio'],
    color: '#f472b6',
    speedLimit: 60,
    departments: ['Cundinamarca', 'Meta'],
    svgPath: 'M 195 248 Q 205 252 215 258 Q 225 264 232 268',
    tollStations: [
      { id: 'C5-01', name: 'NARANJAL', lat: 4.285107, lng: -73.834808, km: 'KM 38', sector: 'BOGOTÁ - VILLAVICENCIO', type: 'COVIANDINA', department: 'Cundinamarca', speedLimit: 60, weightLimit: 32, isCritical: true, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C5-02', name: 'PIPIRAL', lat: 4.201095, lng: -73.721420, km: 'KM 68', sector: 'BOGOTÁ (EL PORTAL) - VILLAVICENCIO', type: 'COVIANDINA', department: 'Cundinamarca', speedLimit: 60, weightLimit: 32, isCritical: true, boothConfig: { total: 5, salida: 3, retorno: 2 } },
      { id: 'C5-03', name: 'OCOA', lat: 4.026246, lng: -73.775192, km: 'KM 88', sector: 'PUENTE SOBRE RÍO OCOA', type: 'INVIAS', department: 'Meta', speedLimit: 60, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C5-04', name: 'LA LIBERTAD', lat: 4.056860, lng: -73.463287, km: 'KM 108', sector: 'VILLAVICENCIO - PUENTE RÍO LA BALSA', type: 'INVIAS', department: 'Meta', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
    ],
  },

  // ══ C6 — BOGOTÁ · TUNJA ══
  {
    id: 'C6',
    name: 'Bogotá – Tunja',
    shortName: 'Bog–Tunja',
    route: 'Ruta 55 / Autopista Norte',
    distanceKm: 150,
    waypoints: ['Bogotá', 'Briceño', 'Zipaquirá', 'Chocontá', 'Tunja'],
    color: '#facc15',
    speedLimit: 80,
    departments: ['Cundinamarca', 'Boyacá'],
    svgPath: 'M 193 245 Q 194 235 196 225 Q 198 215 200 205',
    tollStations: [
      { id: 'C6-01', name: 'ANDES', lat: 4.822679, lng: -74.033081, km: 'KM 18', sector: 'AUTONORTE', type: 'INVIAS', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 8, salida: 6, retorno: 2 } },
      { id: 'C6-02', name: 'EL ROBLE', lat: 5.031299, lng: -73.839882, km: 'KM 62', sector: 'BOGOTÁ - CHOCONTÁ', type: 'BTS AUTOVÍA', department: 'Cundinamarca', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C6-03', name: 'ALBARRACÍN', lat: 5.290461, lng: -73.583504, km: 'KM 110', sector: 'CHOCONTÁ - TUNJA', type: 'BTS AUTOVÍA', department: 'Boyacá', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C6-04', name: 'TUTA', lat: 5.656897, lng: -73.278435, km: 'KM 145', sector: 'TUNJA - DUITAMA', type: 'BTS AUTOVÍA', department: 'Boyacá', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
    ],
  },

  // ══ C7 — SANTA MARTA · BARRANQUILLA ══
  {
    id: 'C7',
    name: 'Santa Marta – Barranquilla',
    shortName: 'SmMarta–Bquilla',
    route: 'Ruta 90 / Troncal del Caribe',
    distanceKm: 95,
    waypoints: ['Santa Marta', 'Ciénaga', 'Tasajera', 'Barranquilla'],
    color: '#60a5fa',
    speedLimit: 80,
    departments: ['Magdalena', 'Atlántico'],
    svgPath: 'M 200 165 Q 210 162 222 160 Q 230 158 238 158',
    tollStations: [
      { id: 'C7-01', name: 'NEGUANJE', lat: 11.253129, lng: -74.109322, km: 'KM 12', sector: 'SANTA MARTA - RÍO PALOMINO', type: 'INVIAS', department: 'Magdalena', speedLimit: 80, weightLimit: 32, boothConfig: { total: 4, salida: 3, retorno: 1 } },
      { id: 'C7-02', name: 'TUCUNICA', lat: 10.608947, lng: -74.168495, km: 'KM 40', sector: 'ARACATACA - YE DE CIÉNAGA', type: 'RUTA COSTERA', department: 'Magdalena', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C7-03', name: 'TASAJERA', lat: 10.977188, lng: -74.336664, km: 'KM 52', sector: 'BARRANQUILLA - SANTA MARTA', type: 'RUTA COSTERA', department: 'Magdalena', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C7-04', name: 'LAUREANO GÓMEZ', lat: 10.978719, lng: -74.729719, km: 'KM 68', sector: 'BARRANQUILLA - SANTA MARTA', type: 'AUTOPISTAS DEL CARIBE', department: 'Atlántico', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C7-05', name: 'SABANAGRANDE', lat: 10.799582, lng: -74.759003, km: 'KM 75', sector: 'PALMAR DE VARELA - BARRANQUILLA', type: 'AUTOPISTAS DEL CARIBE', department: 'Atlántico', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
      { id: 'C7-06', name: 'GALAPA', lat: 10.837545, lng: -74.902122, km: 'KM 88', sector: 'SABANALARGA - BARRANQUILLA', type: 'AUTOPISTAS DEL CARIBE', department: 'Atlántico', speedLimit: 80, weightLimit: 32, boothConfig: { total: 6, salida: 4, retorno: 2 } },
    ],
  },
];

// Helper: obtener corredor por ID
export const getCorridorById = (id) => NEXUS_CORRIDORS.find(c => c.id === id);

// Total de peajes en el sistema
export const TOTAL_TOLL_STATIONS = NEXUS_CORRIDORS.reduce(
  (acc, c) => acc + c.tollStations.length, 0
);

// Helper: todos los peajes aplanados
export const ALL_TOLL_STATIONS = NEXUS_CORRIDORS.flatMap(c =>
  c.tollStations.map(t => ({ ...t, corridorId: c.id, corridorColor: c.color, corridorName: c.shortName }))
);

// ─── DATOS SEMANA SANTA 2026 ─────────────────────────────────
export const SEMANA_SANTA_2026 = {
  startDate: new Date('2026-03-22'),
  endDate: new Date('2026-04-05'),
  peakDays: ['2026-03-23', '2026-04-02', '2026-04-04', '2026-04-05'],
  returnDays: ['2026-03-23', '2026-04-04', '2026-04-05'],
  title: 'Semana Santa 2026',
  operationMode: 'PLAN DE CONTINGENCIA DITRA',
};

// Fuentes de datos
export const DATA_SOURCES = [
  { name: 'Google Street View', license: 'Embed público', status: 'active' },
  { name: 'Google Maps Satellite', license: 'Embed público', status: 'active' },
  { name: 'OpenStreetMap', license: 'ODbL 1.0', status: 'active' },
  { name: 'INVÍAS peajes_act.xlsx', license: 'Inventario oficial', status: 'integrated' },
  { name: 'INVÍAS VIITS Sensores', license: 'Propietario', status: 'simulated' },
];
