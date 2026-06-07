/**
 * VIITS NEXUS — Corredores Logísticos Estratégicos de Colombia
 * Fuente: Resolución Mintransporte 20223040002435 de 2022
 *         "Por la cual se establecen los Corredores Logísticos
 *          Estratégicos del país".
 * Versión: Logistics Module v1.0 — DITRA / VIITS 2026
 *
 * Este archivo NO sustituye a NEXUS_CORRIDORS (src/data/nexusCorridors.js)
 * ni a CORRIDORS (src/data/corridors.js). Los REFERENCIA por id de peaje.
 *
 * Convención de IDs:
 *   'L1'..'L7'         — corredor logístico
 *   'L{n}-N{nn}'       — nodo (ciudad cabecera / control)
 *   'L{n}-S{nn}'       — segmento (sub-tramo entre dos nodos consecutivos)
 *   Los peajes conservan su id original 'C{n}-{NN}' de NEXUS_CORRIDORS.
 */

import {
  CORRIDOR_COLORS,
  IRT_THRESHOLDS,
  getIRTLevel,
  computeIRT,
  ALL_TOLL_STATIONS,
  HIGH_RISK_TOLLS,
  REPRESENTATIVE_TOLLS,
} from '../../../data/nexusCorridors';

// ─── Re-export de utilidades de IRT ─────────────────────────
// El resto del módulo logistics NO debe importar nexusCorridors
// directamente: re-exporta aquí para tener una sola superficie.
export {
  CORRIDOR_COLORS,
  IRT_THRESHOLDS,
  getIRTLevel,
  computeIRT,
  ALL_TOLL_STATIONS,
  HIGH_RISK_TOLLS,
  REPRESENTATIVE_TOLLS,
};

// ─── Mapeo L{n} -> [C{n}, ...] (NEXUS contributors) ─────────
// Qué corredores NEXUS aportan peajes a cada corredor logístico.
// Lista oficial: Resolución Mintransporte 20223040002435/2022.
export const LOGISTICS_TO_NEXUS = {
  L1: ['C3', 'C4', 'C2'],   // Bogotá–Buenaventura–Ipiales (Pacífico + Frontera Sur)
  L2: ['C2', 'C1'],         // Cali–Medellín–Cartagena (Eje occidental + Caribe)
  L3: ['C1', 'C7'],         // Bogotá–Barranquilla (Ruta del Sol + Caribe central)
  L4: ['C6'],               // Bogotá–Cúcuta (Frontera Noreste, vía Boyacá)
  L5: ['C1'],               // Medellín–Bucaramanga (Antioquia–Santander)
  L6: ['C5'],               // Bogotá–Yopal (Llanos)
  L7: ['C3'],               // Bogotá–Puerto Asís (Frontera Sur, Marginal de la Selva)
};

// ─── Mapeo de color L{n} reutilizando CORRIDOR_COLORS NEXUS ─
// 7 colores distintos, sin repetición, para diferenciación visual.
export const LOGISTICS_COLORS = {
  L1: CORRIDOR_COLORS.C3, // Naranja — Pacífico (Bogotá-Buenaventura-Ipiales)
  L2: CORRIDOR_COLORS.C1, // Cian — Eje occidental + Caribe (Cali-Medellín-Cartagena)
  L3: CORRIDOR_COLORS.C7, // Azul medio — Caribe central (Bogotá-Barranquilla)
  L4: CORRIDOR_COLORS.C6, // Amarillo — Frontera Noreste (Bogotá-Cúcuta)
  L5: CORRIDOR_COLORS.C4, // Verde — Antioquia-Santander (Medellín-Bucaramanga)
  L6: CORRIDOR_COLORS.C5, // Rosa — Llanos (Bogotá-Yopal)
  L7: CORRIDOR_COLORS.C2, // Violeta — Frontera Sur (Bogotá-Puerto Asís)
};

// ─── Helper: resuelve datos completos de un peaje ───────────
// Devuelve el objeto NEXUS (con lat/lng, sector, km, boothConfig,
// concesionario via type, etc.) más el corridorId NEXUS de origen.
// Si no encuentra el peaje, devuelve null.
export const resolveTollDetails = (tollId) => {
  if (!tollId) return null;
  const toll = ALL_TOLL_STATIONS.find((t) => t.id === tollId);
  if (!toll) return null;
  return {
    ...toll,
    nexusCorridorId: toll.corridorId, // 'C1'..'C7' — para link a /monitor
  };
};

// ─── 7 CORREDORES LOGÍSTICOS ESTRATÉGICOS ───────────────────
// Cada peaje es SÓLO una referencia por id; los detalles
// (lat/lng/sector/km/boothConfig) viven en NEXUS_CORRIDORS.
// Los waypoints son únicamente ciudades reales — NUNCA
// coordenadas de infraestructura crítica.
export const LOGISTICS_CORRIDORS = [

  // ══ L1 — BOGOTÁ · BUENAVENTURA · IPIALES ══════════════════
  // Corredor Pacífico + Frontera Sur. Conecta el interior con
  // el principal puerto del Pacífico y con la frontera de Ecuador.
  {
    id: 'L1',
    code: 'CL-1',
    name: 'Bogotá – Buenaventura – Ipiales',
    shortName: 'Bog–Bvtra–Ipi',
    description: 'Corredor Pacífico + Frontera Sur (Rumichaca)',
    nature: 'Comercio exterior · Frontera',
    origin: 'Bogotá',
    destination: 'Ipiales (Frontera Rumichaca)',
    totalKm: 1300,
    totalDistanceKm: 1300,
    color: CORRIDOR_COLORS.C3,
    legacyCorridorIds: ['C3', 'C4', 'C2'],
    waypoints: [
      { name: 'Bogotá',       lat: 4.7110, lng: -74.0721 },
      { name: 'Girardot',     lat: 4.3030, lng: -74.8060 },
      { name: 'Ibagué',       lat: 4.4389, lng: -75.2322 },
      { name: 'Cajamarca',    lat: 4.4407, lng: -75.4302 },
      { name: 'Calarcá',      lat: 4.5246, lng: -75.6440 },
      { name: 'Armenia',      lat: 4.5339, lng: -75.6811 },
      { name: 'Cartago',      lat: 4.7460, lng: -75.9120 },
      { name: 'Buga',         lat: 3.9020, lng: -76.2980 },
      { name: 'Cali',         lat: 3.4516, lng: -76.5320 },
      { name: 'Buenaventura', lat: 3.8801, lng: -77.0312 },
      { name: 'Popayán',      lat: 2.4448, lng: -76.6147 },
      { name: 'Pasto',        lat: 1.2136, lng: -77.2811 },
      { name: 'Ipiales',      lat: 0.8260, lng: -77.6456 },
    ],
    nodes: [
      { id: 'L1-N01', name: 'Bogotá',       lat: 4.7110, lng: -74.0721, kind: 'origin'  },
      { id: 'L1-N02', name: 'Girardot',     lat: 4.3030, lng: -74.8060, kind: 'transit' },
      { id: 'L1-N03', name: 'Ibagué',       lat: 4.4389, lng: -75.2322, kind: 'transit' },
      { id: 'L1-N04', name: 'Armenia',      lat: 4.5339, lng: -75.6811, kind: 'transit' },
      { id: 'L1-N05', name: 'Cali',         lat: 3.4516, lng: -76.5320, kind: 'transit' },
      { id: 'L1-N06', name: 'Buenaventura', lat: 3.8801, lng: -77.0312, kind: 'port'    },
      { id: 'L1-N07', name: 'Popayán',      lat: 2.4448, lng: -76.6147, kind: 'transit' },
      { id: 'L1-N08', name: 'Pasto',        lat: 1.2136, lng: -77.2811, kind: 'transit' },
      { id: 'L1-N09', name: 'Ipiales',      lat: 0.8260, lng: -77.6456, kind: 'border'  },
    ],
    segments: [
      {
        id: 'L1-S01', fromNodeId: 'L1-N01', toNodeId: 'L1-N02',
        label: 'Bogotá – Girardot', distanceKm: 135, speedLimit: 80,
        polyline: [[4.7110, -74.0721], [4.5370, -74.2721], [4.3030, -74.8060]],
        tollRefs: ['C3-01', 'C3-02', 'C3-03'],
        departments: ['Cundinamarca'],
      },
      {
        id: 'L1-S02', fromNodeId: 'L1-N02', toNodeId: 'L1-N03',
        label: 'Girardot – Ibagué', distanceKm: 70, speedLimit: 80,
        polyline: [[4.3030, -74.8060], [4.1920, -74.8610], [4.4389, -75.2322]],
        tollRefs: ['C3-04', 'C4-01'],
        departments: ['Cundinamarca', 'Tolima'],
      },
      {
        id: 'L1-S03', fromNodeId: 'L1-N03', toNodeId: 'L1-N04',
        label: 'Ibagué – Armenia (La Línea)', distanceKm: 100, speedLimit: 60,
        polyline: [[4.4389, -75.2322], [4.4455, -75.5188], [4.5234, -75.5893], [4.5339, -75.6811]],
        tollRefs: ['C4-02', 'C4-03'],
        departments: ['Tolima', 'Quindío'],
      },
      {
        id: 'L1-S04', fromNodeId: 'L1-N04', toNodeId: 'L1-N05',
        label: 'Armenia – Cali', distanceKm: 200, speedLimit: 80,
        polyline: [[4.5339, -75.6811], [4.7934, -75.8599], [4.2524, -76.1184], [3.4516, -76.5320]],
        tollRefs: ['C2-08', 'C2-07', 'C2-06', 'C2-05', 'C2-04', 'C2-03'],
        departments: ['Quindío', 'Valle del Cauca'],
      },
      {
        id: 'L1-S05', fromNodeId: 'L1-N05', toNodeId: 'L1-N06',
        label: 'Cali – Buenaventura', distanceKm: 125, speedLimit: 80,
        polyline: [[3.4516, -76.5320], [3.6500, -76.8000], [3.8801, -77.0312]],
        tollRefs: [],
        departments: ['Valle del Cauca'],
      },
      {
        id: 'L1-S06', fromNodeId: 'L1-N05', toNodeId: 'L1-N07',
        label: 'Cali – Popayán', distanceKm: 140, speedLimit: 80,
        polyline: [[3.4516, -76.5320], [3.1512, -76.4600], [2.4448, -76.6147]],
        tollRefs: ['C2-02', 'C2-01'],
        departments: ['Valle del Cauca', 'Cauca'],
      },
      {
        id: 'L1-S07', fromNodeId: 'L1-N07', toNodeId: 'L1-N08',
        label: 'Popayán – Pasto', distanceKm: 285, speedLimit: 80,
        polyline: [[2.4448, -76.6147], [1.6000, -77.0000], [1.2136, -77.2811]],
        tollRefs: [],
        departments: ['Cauca', 'Nariño'],
      },
      {
        id: 'L1-S08', fromNodeId: 'L1-N08', toNodeId: 'L1-N09',
        label: 'Pasto – Ipiales (Rumichaca)', distanceKm: 80, speedLimit: 80,
        polyline: [[1.2136, -77.2811], [1.0000, -77.4500], [0.8260, -77.6456]],
        tollRefs: [],
        departments: ['Nariño'],
      },
    ],
    tollRefs: [
      'C3-01', 'C3-02', 'C3-03', 'C3-04',
      'C4-01', 'C4-02', 'C4-03',
      'C2-01', 'C2-02', 'C2-03', 'C2-04', 'C2-05', 'C2-06', 'C2-07', 'C2-08',
    ],
    tolls: [
      { id: 'C3-01', name: 'CHUSACÁ',            sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', km: 'KM 14'  },
      { id: 'C3-02', name: 'CHINAUTA',           sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', km: 'KM 68'  },
      { id: 'C3-03', name: 'PUBENZA',            sector: 'GIRARDOT - TOCAIMA',                 km: 'KM 100' },
      { id: 'C3-04', name: 'FLANDES',            sector: 'EL ESPINAL - GIRARDOT',              km: 'KM 130' },
      { id: 'C4-01', name: 'GUALANDAY',          sector: 'IBAGUÉ - CRUCE RUTA 45 (ESPINAL)',   km: 'KM 15'  },
      { id: 'C4-02', name: 'TÚNEL LA LÍNEA (TOLIMA)',  sector: 'LA LÍNEA - CAJAMARCA',         km: 'KM 48'  },
      { id: 'C4-03', name: 'TÚNEL LA LÍNEA (QUINDÍO)', sector: 'ARMENIA - LA LÍNEA',           km: 'KM 53'  },
      { id: 'C2-01', name: 'EL BORDO',           sector: 'MOJARRAS - POPAYÁN',                 km: 'KM 40'  },
      { id: 'C2-02', name: 'VILLARICA',          sector: 'POPAYÁN - JAMUNDÍ',                  km: 'KM 85'  },
      { id: 'C2-03', name: 'CENCAR',             sector: 'CALI - YUMBO',                       km: 'KM 135' },
      { id: 'C2-04', name: 'CERRITO',            sector: 'CALI - PALMIRA - BUGA',              km: 'KM 175' },
      { id: 'C2-05', name: 'MEDIACANOA',         sector: 'YUMBO - MEDIACANOA',                 km: 'KM 210' },
      { id: 'C2-06', name: 'LA URIBE',           sector: 'ANDALUCÍA - LA PAILA - LA VICTORIA', km: 'KM 265' },
      { id: 'C2-07', name: 'COROZAL',            sector: 'LA PAILA - CLUB CAMPESTRE',          km: 'KM 300' },
      { id: 'C2-08', name: 'CERRITOS II',        sector: 'LA VICTORIA - CARTAGO - CERRITOS',   km: 'KM 340' },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['comercio_exterior', 'frontera_sur', 'exodo_semana_santa'],
      keyPorts: ['Buenaventura'],
      borders: ['Ipiales–Rumichaca'],
    },
  },

  // ══ L2 — CALI · MEDELLÍN · CARTAGENA ══════════════════════
  // Eje occidental + Caribe. Conecta el Valle del Cauca con
  // Antioquia y los puertos del Caribe vía Troncal de Occidente.
  {
    id: 'L2',
    code: 'CL-2',
    name: 'Cali – Medellín – Cartagena',
    shortName: 'Cali–Med–Ctg',
    description: 'Eje occidental + Caribe',
    nature: 'Comercio exterior · Industrial · Puertos',
    origin: 'Cali',
    destination: 'Cartagena',
    totalKm: 1105,
    totalDistanceKm: 1105,
    color: CORRIDOR_COLORS.C1,
    legacyCorridorIds: ['C2', 'C1'],
    waypoints: [
      { name: 'Cali',         lat:  3.4516, lng: -76.5320 },
      { name: 'Buga',         lat:  3.9020, lng: -76.2980 },
      { name: 'Cartago',      lat:  4.7460, lng: -75.9120 },
      { name: 'Pereira',      lat:  4.8133, lng: -75.6961 },
      { name: 'Manizales',    lat:  5.0703, lng: -75.5138 },
      { name: 'La Pintada',   lat:  5.7456, lng: -75.6052 },
      { name: 'Medellín',     lat:  6.2476, lng: -75.5658 },
      { name: 'Caucasia',     lat:  7.9783, lng: -75.1976 },
      { name: 'Planeta Rica', lat:  8.4117, lng: -75.5836 },
      { name: 'Sincelejo',    lat:  9.3047, lng: -75.3978 },
      { name: 'Cartagena',    lat: 10.3997, lng: -75.5144 },
    ],
    nodes: [
      { id: 'L2-N01', name: 'Cali',       lat:  3.4516, lng: -76.5320, kind: 'origin'  },
      { id: 'L2-N02', name: 'Buga',       lat:  3.9020, lng: -76.2980, kind: 'transit' },
      { id: 'L2-N03', name: 'Cartago',    lat:  4.7460, lng: -75.9120, kind: 'transit' },
      { id: 'L2-N04', name: 'La Pintada', lat:  5.7456, lng: -75.6052, kind: 'transit' },
      { id: 'L2-N05', name: 'Medellín',   lat:  6.2476, lng: -75.5658, kind: 'transit' },
      { id: 'L2-N06', name: 'Caucasia',   lat:  7.9783, lng: -75.1976, kind: 'transit' },
      { id: 'L2-N07', name: 'Sincelejo',  lat:  9.3047, lng: -75.3978, kind: 'transit' },
      { id: 'L2-N08', name: 'Cartagena',  lat: 10.3997, lng: -75.5144, kind: 'port'    },
    ],
    segments: [
      {
        id: 'L2-S01', fromNodeId: 'L2-N01', toNodeId: 'L2-N02',
        label: 'Cali – Buga', distanceKm: 75, speedLimit: 80,
        polyline: [[3.4516, -76.5320], [3.7131, -76.3192], [3.9020, -76.2980]],
        tollRefs: ['C2-03', 'C2-04'],
        departments: ['Valle del Cauca'],
      },
      {
        id: 'L2-S02', fromNodeId: 'L2-N02', toNodeId: 'L2-N03',
        label: 'Buga – Cartago', distanceKm: 165, speedLimit: 80,
        polyline: [[3.9020, -76.2980], [4.2525, -76.1184], [4.7460, -75.9120]],
        tollRefs: ['C2-05', 'C2-06', 'C2-07', 'C2-08'],
        departments: ['Valle del Cauca', 'Risaralda'],
      },
      {
        id: 'L2-S03', fromNodeId: 'L2-N03', toNodeId: 'L2-N04',
        label: 'Cartago – La Pintada', distanceKm: 200, speedLimit: 60,
        polyline: [[4.7460, -75.9120], [5.0703, -75.5138], [5.4000, -75.5600], [5.7456, -75.6052]],
        tollRefs: [],
        departments: ['Risaralda', 'Caldas', 'Antioquia'],
      },
      {
        id: 'L2-S04', fromNodeId: 'L2-N04', toNodeId: 'L2-N05',
        label: 'La Pintada – Medellín', distanceKm: 75, speedLimit: 60,
        polyline: [[5.7456, -75.6052], [5.9000, -75.6000], [6.2476, -75.5658]],
        tollRefs: [],
        departments: ['Antioquia'],
      },
      {
        id: 'L2-S05', fromNodeId: 'L2-N05', toNodeId: 'L2-N06',
        label: 'Medellín – Caucasia', distanceKm: 270, speedLimit: 80,
        polyline: [[6.2476, -75.5658], [6.4780, -75.3786], [7.0000, -75.3000], [7.9783, -75.1976]],
        tollRefs: ['C1-01', 'C1-02', 'C1-03', 'C1-04'],
        departments: ['Antioquia'],
      },
      {
        id: 'L2-S06', fromNodeId: 'L2-N06', toNodeId: 'L2-N07',
        label: 'Caucasia – Sincelejo', distanceKm: 200, speedLimit: 80,
        polyline: [[7.9783, -75.1976], [8.4117, -75.5836], [9.3047, -75.3978]],
        tollRefs: [],
        departments: ['Antioquia', 'Córdoba', 'Sucre'],
      },
      {
        id: 'L2-S07', fromNodeId: 'L2-N07', toNodeId: 'L2-N08',
        label: 'Sincelejo – Cartagena', distanceKm: 120, speedLimit: 80,
        polyline: [[9.3047, -75.3978], [9.8000, -75.4500], [10.3997, -75.5144]],
        tollRefs: [],
        departments: ['Sucre', 'Bolívar'],
      },
    ],
    tollRefs: [
      'C2-03', 'C2-04', 'C2-05', 'C2-06', 'C2-07', 'C2-08',
      'C1-01', 'C1-02', 'C1-03', 'C1-04',
    ],
    tolls: [
      { id: 'C2-03', name: 'CENCAR',      sector: 'CALI - YUMBO',                       km: 'KM 135' },
      { id: 'C2-04', name: 'CERRITO',     sector: 'CALI - PALMIRA - BUGA',              km: 'KM 175' },
      { id: 'C2-05', name: 'MEDIACANOA',  sector: 'YUMBO - MEDIACANOA',                 km: 'KM 210' },
      { id: 'C2-06', name: 'LA URIBE',    sector: 'ANDALUCÍA - LA PAILA - LA VICTORIA', km: 'KM 265' },
      { id: 'C2-07', name: 'COROZAL',     sector: 'LA PAILA - CLUB CAMPESTRE',          km: 'KM 300' },
      { id: 'C2-08', name: 'CERRITOS II', sector: 'LA VICTORIA - CARTAGO - CERRITOS',   km: 'KM 340' },
      { id: 'C1-01', name: 'NIQUÍA',      sector: 'MEDELLÍN - HOYO RICO',               km: 'KM 20'  },
      { id: 'C1-02', name: 'GUARNE',      sector: 'MEDELLÍN - SANTUARIO',               km: 'KM 28'  },
      { id: 'C1-03', name: 'TRAPICHE',    sector: 'MEDELLÍN - HOYO RICO',               km: 'KM 45'  },
      { id: 'C1-04', name: 'PANDEQUESO',  sector: 'MEDELLÍN - HOYO RICO',               km: 'KM 58'  },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['comercio_exterior', 'industrial', 'puertos'],
      keyPorts: ['Cartagena'],
      borders: [],
    },
  },

  // ══ L3 — BOGOTÁ · BARRANQUILLA ════════════════════════════
  // Caribe central. Conecta el interior con el puerto de
  // Barranquilla a través de la Ruta del Sol y el Magdalena.
  {
    id: 'L3',
    code: 'CL-3',
    name: 'Bogotá – Barranquilla',
    shortName: 'Bog–Bquilla',
    description: 'Caribe central (Ruta del Sol)',
    nature: 'Comercio exterior · Puertos',
    origin: 'Bogotá',
    destination: 'Barranquilla',
    totalKm: 985,
    totalDistanceKm: 985,
    color: CORRIDOR_COLORS.C7,
    legacyCorridorIds: ['C1', 'C7'],
    waypoints: [
      { name: 'Bogotá',       lat:  4.7110, lng: -74.0721 },
      { name: 'Villeta',      lat:  5.0086, lng: -74.4750 },
      { name: 'Honda',        lat:  5.2015, lng: -74.7400 },
      { name: 'La Dorada',    lat:  5.4500, lng: -74.6650 },
      { name: 'Aguachica',    lat:  8.3094, lng: -73.6147 },
      { name: 'Plato',        lat:  9.7989, lng: -74.7833 },
      { name: 'Barranquilla', lat: 10.9685, lng: -74.7813 },
    ],
    nodes: [
      { id: 'L3-N01', name: 'Bogotá',       lat:  4.7110, lng: -74.0721, kind: 'origin'      },
      { id: 'L3-N02', name: 'Honda',        lat:  5.2015, lng: -74.7400, kind: 'transit'     },
      { id: 'L3-N03', name: 'La Dorada',    lat:  5.4500, lng: -74.6650, kind: 'transit'     },
      { id: 'L3-N04', name: 'Aguachica',    lat:  8.3094, lng: -73.6147, kind: 'transit'     },
      { id: 'L3-N05', name: 'Plato',        lat:  9.7989, lng: -74.7833, kind: 'transit'     },
      { id: 'L3-N06', name: 'Barranquilla', lat: 10.9685, lng: -74.7813, kind: 'port'        },
    ],
    segments: [
      {
        id: 'L3-S01', fromNodeId: 'L3-N01', toNodeId: 'L3-N02',
        label: 'Bogotá – Honda', distanceKm: 165, speedLimit: 80,
        polyline: [[4.7110, -74.0721], [5.0086, -74.4750], [5.2015, -74.7400]],
        tollRefs: ['C1-08', 'C1-07'],
        departments: ['Cundinamarca', 'Tolima'],
      },
      {
        id: 'L3-S02', fromNodeId: 'L3-N02', toNodeId: 'L3-N03',
        label: 'Honda – La Dorada', distanceKm: 40, speedLimit: 80,
        polyline: [[5.2015, -74.7400], [5.3300, -74.7000], [5.4500, -74.6650]],
        tollRefs: [],
        departments: ['Tolima', 'Caldas'],
      },
      {
        id: 'L3-S03', fromNodeId: 'L3-N03', toNodeId: 'L3-N04',
        label: 'La Dorada – Aguachica', distanceKm: 335, speedLimit: 80,
        polyline: [[5.4500, -74.6650], [6.8000, -74.0000], [8.3094, -73.6147]],
        tollRefs: [],
        departments: ['Caldas', 'Santander', 'Cesar'],
      },
      {
        id: 'L3-S04', fromNodeId: 'L3-N04', toNodeId: 'L3-N05',
        label: 'Aguachica – Plato', distanceKm: 220, speedLimit: 80,
        polyline: [[8.3094, -73.6147], [9.1000, -74.2000], [9.7989, -74.7833]],
        tollRefs: [],
        departments: ['Cesar', 'Magdalena'],
      },
      {
        id: 'L3-S05', fromNodeId: 'L3-N05', toNodeId: 'L3-N06',
        label: 'Plato – Barranquilla', distanceKm: 225, speedLimit: 80,
        polyline: [[9.7989, -74.7833], [10.4000, -74.8500], [10.9685, -74.7813]],
        tollRefs: ['C7-04', 'C7-05', 'C7-06'],
        departments: ['Magdalena', 'Atlántico'],
      },
    ],
    tollRefs: ['C1-07', 'C1-08', 'C7-04', 'C7-05', 'C7-06'],
    tolls: [
      { id: 'C1-07', name: 'HONDA',          sector: 'FRESNO - HONDA',                  km: 'KM 280' },
      { id: 'C1-08', name: 'SIBERIA',        sector: 'VILLETA - BOGOTÁ',                km: 'KM 480' },
      { id: 'C7-04', name: 'LAUREANO GÓMEZ', sector: 'BARRANQUILLA - SANTA MARTA',      km: 'KM 68'  },
      { id: 'C7-05', name: 'SABANAGRANDE',   sector: 'PALMAR DE VARELA - BARRANQUILLA', km: 'KM 75'  },
      { id: 'C7-06', name: 'GALAPA',         sector: 'SABANALARGA - BARRANQUILLA',      km: 'KM 88'  },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['comercio_exterior', 'puertos', 'ruta_del_sol'],
      keyPorts: ['Barranquilla'],
      borders: [],
    },
  },

  // ══ L4 — BOGOTÁ · CÚCUTA ══════════════════════════════════
  // Frontera Noreste con Venezuela vía Tunja-Bucaramanga.
  // Comercio binacional y flujo fronterizo.
  {
    id: 'L4',
    code: 'CL-4',
    name: 'Bogotá – Cúcuta',
    shortName: 'Bog–Cúcuta',
    description: 'Frontera Noreste (Venezuela)',
    nature: 'Frontera · Comercio binacional',
    origin: 'Bogotá',
    destination: 'Cúcuta',
    totalKm: 660,
    totalDistanceKm: 660,
    color: CORRIDOR_COLORS.C6,
    legacyCorridorIds: ['C6'],
    waypoints: [
      { name: 'Bogotá',      lat: 4.7110, lng: -74.0721 },
      { name: 'Tunja',       lat: 5.5353, lng: -73.3678 },
      { name: 'Duitama',     lat: 5.8275, lng: -73.0322 },
      { name: 'Bucaramanga', lat: 7.1193, lng: -73.1227 },
      { name: 'Pamplona',    lat: 7.3756, lng: -72.6483 },
      { name: 'Cúcuta',      lat: 7.8939, lng: -72.5078 },
    ],
    nodes: [
      { id: 'L4-N01', name: 'Bogotá',      lat: 4.7110, lng: -74.0721, kind: 'origin'  },
      { id: 'L4-N02', name: 'Tunja',       lat: 5.5353, lng: -73.3678, kind: 'transit' },
      { id: 'L4-N03', name: 'Duitama',     lat: 5.8275, lng: -73.0322, kind: 'transit' },
      { id: 'L4-N04', name: 'Bucaramanga', lat: 7.1193, lng: -73.1227, kind: 'transit' },
      { id: 'L4-N05', name: 'Pamplona',    lat: 7.3756, lng: -72.6483, kind: 'transit' },
      { id: 'L4-N06', name: 'Cúcuta',      lat: 7.8939, lng: -72.5078, kind: 'border'  },
    ],
    segments: [
      {
        id: 'L4-S01', fromNodeId: 'L4-N01', toNodeId: 'L4-N02',
        label: 'Bogotá – Tunja', distanceKm: 150, speedLimit: 80,
        polyline: [[4.7110, -74.0721], [4.8227, -74.0331], [5.0313, -73.8399], [5.2905, -73.5835], [5.5353, -73.3678]],
        tollRefs: ['C6-01', 'C6-02', 'C6-03'],
        departments: ['Cundinamarca', 'Boyacá'],
      },
      {
        id: 'L4-S02', fromNodeId: 'L4-N02', toNodeId: 'L4-N03',
        label: 'Tunja – Duitama', distanceKm: 45, speedLimit: 80,
        polyline: [[5.5353, -73.3678], [5.6569, -73.2784], [5.8275, -73.0322]],
        tollRefs: ['C6-04'],
        departments: ['Boyacá'],
      },
      {
        id: 'L4-S03', fromNodeId: 'L4-N03', toNodeId: 'L4-N04',
        label: 'Duitama – Bucaramanga', distanceKm: 270, speedLimit: 80,
        polyline: [[5.8275, -73.0322], [6.5500, -73.1500], [7.1193, -73.1227]],
        tollRefs: [],
        departments: ['Boyacá', 'Santander'],
      },
      {
        id: 'L4-S04', fromNodeId: 'L4-N04', toNodeId: 'L4-N05',
        label: 'Bucaramanga – Pamplona', distanceKm: 120, speedLimit: 60,
        polyline: [[7.1193, -73.1227], [7.2500, -72.9000], [7.3756, -72.6483]],
        tollRefs: [],
        departments: ['Santander', 'Norte de Santander'],
      },
      {
        id: 'L4-S05', fromNodeId: 'L4-N05', toNodeId: 'L4-N06',
        label: 'Pamplona – Cúcuta', distanceKm: 75, speedLimit: 60,
        polyline: [[7.3756, -72.6483], [7.6000, -72.5500], [7.8939, -72.5078]],
        tollRefs: [],
        departments: ['Norte de Santander'],
      },
    ],
    tollRefs: ['C6-01', 'C6-02', 'C6-03', 'C6-04'],
    tolls: [
      { id: 'C6-01', name: 'ANDES',      sector: 'AUTONORTE',         km: 'KM 18'  },
      { id: 'C6-02', name: 'EL ROBLE',   sector: 'BOGOTÁ - CHOCONTÁ', km: 'KM 62'  },
      { id: 'C6-03', name: 'ALBARRACÍN', sector: 'CHOCONTÁ - TUNJA',  km: 'KM 110' },
      { id: 'C6-04', name: 'TUTA',       sector: 'TUNJA - DUITAMA',   km: 'KM 145' },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['frontera_noreste', 'comercio_binacional'],
      keyPorts: [],
      borders: ['Cúcuta–Puente Simón Bolívar'],
    },
  },

  // ══ L5 — MEDELLÍN · BUCARAMANGA ═══════════════════════════
  // Antioquia-Santander vía Puerto Berrío y el Magdalena Medio.
  // Conecta los dos principales polos industriales del nororiente.
  {
    id: 'L5',
    code: 'CL-5',
    name: 'Medellín – Bucaramanga',
    shortName: 'Med–Bcga',
    description: 'Antioquia-Santander (Magdalena Medio)',
    nature: 'Industrial · Comercio interior',
    origin: 'Medellín',
    destination: 'Bucaramanga',
    totalKm: 410,
    totalDistanceKm: 410,
    color: CORRIDOR_COLORS.C4,
    legacyCorridorIds: ['C1'],
    waypoints: [
      { name: 'Medellín',        lat: 6.2476, lng: -75.5658 },
      { name: 'Hoyo Rico',       lat: 6.4500, lng: -75.4000 },
      { name: 'Cisneros',        lat: 6.5363, lng: -75.0748 },
      { name: 'Puerto Berrío',   lat: 6.4966, lng: -74.5014 },
      { name: 'Barrancabermeja', lat: 7.0653, lng: -73.8547 },
      { name: 'Bucaramanga',     lat: 7.1193, lng: -73.1227 },
    ],
    nodes: [
      { id: 'L5-N01', name: 'Medellín',        lat: 6.2476, lng: -75.5658, kind: 'origin'  },
      { id: 'L5-N02', name: 'Hoyo Rico',       lat: 6.4500, lng: -75.4000, kind: 'transit' },
      { id: 'L5-N03', name: 'Cisneros',        lat: 6.5363, lng: -75.0748, kind: 'transit' },
      { id: 'L5-N04', name: 'Puerto Berrío',   lat: 6.4966, lng: -74.5014, kind: 'transit' },
      { id: 'L5-N05', name: 'Barrancabermeja', lat: 7.0653, lng: -73.8547, kind: 'transit' },
      { id: 'L5-N06', name: 'Bucaramanga',     lat: 7.1193, lng: -73.1227, kind: 'transit' },
    ],
    segments: [
      {
        id: 'L5-S01', fromNodeId: 'L5-N01', toNodeId: 'L5-N02',
        label: 'Medellín – Hoyo Rico', distanceKm: 60, speedLimit: 80,
        polyline: [[6.2476, -75.5658], [6.3300, -75.4800], [6.4500, -75.4000]],
        tollRefs: ['C1-01', 'C1-02', 'C1-03', 'C1-04'],
        departments: ['Antioquia'],
      },
      {
        id: 'L5-S02', fromNodeId: 'L5-N02', toNodeId: 'L5-N03',
        label: 'Hoyo Rico – Cisneros', distanceKm: 35, speedLimit: 80,
        polyline: [[6.4500, -75.4000], [6.5000, -75.2400], [6.5363, -75.0748]],
        tollRefs: ['C1-05'],
        departments: ['Antioquia'],
      },
      {
        id: 'L5-S03', fromNodeId: 'L5-N03', toNodeId: 'L5-N04',
        label: 'Cisneros – Puerto Berrío', distanceKm: 70, speedLimit: 80,
        polyline: [[6.5363, -75.0748], [6.5200, -74.8000], [6.4966, -74.5014]],
        tollRefs: ['C1-06'],
        departments: ['Antioquia'],
      },
      {
        id: 'L5-S04', fromNodeId: 'L5-N04', toNodeId: 'L5-N05',
        label: 'Puerto Berrío – Barrancabermeja', distanceKm: 130, speedLimit: 80,
        polyline: [[6.4966, -74.5014], [6.7000, -74.0000], [7.0653, -73.8547]],
        tollRefs: [],
        departments: ['Antioquia', 'Santander'],
      },
      {
        id: 'L5-S05', fromNodeId: 'L5-N05', toNodeId: 'L5-N06',
        label: 'Barrancabermeja – Bucaramanga', distanceKm: 115, speedLimit: 80,
        polyline: [[7.0653, -73.8547], [7.0900, -73.4500], [7.1193, -73.1227]],
        tollRefs: [],
        departments: ['Santander'],
      },
    ],
    tollRefs: ['C1-01', 'C1-02', 'C1-03', 'C1-04', 'C1-05', 'C1-06'],
    tolls: [
      { id: 'C1-01', name: 'NIQUÍA',        sector: 'MEDELLÍN - HOYO RICO',     km: 'KM 20'  },
      { id: 'C1-02', name: 'GUARNE',        sector: 'MEDELLÍN - SANTUARIO',     km: 'KM 28'  },
      { id: 'C1-03', name: 'TRAPICHE',      sector: 'MEDELLÍN - HOYO RICO',     km: 'KM 45'  },
      { id: 'C1-04', name: 'PANDEQUESO',    sector: 'MEDELLÍN - HOYO RICO',     km: 'KM 58'  },
      { id: 'C1-05', name: 'CISNEROS',      sector: 'CISNEROS - ALTO DE DOLORES', km: 'KM 95'  },
      { id: 'C1-06', name: 'PUERTO BERRÍO', sector: 'CISNEROS - PUERTO BERRÍO', km: 'KM 165' },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['industrial', 'comercio_interior'],
      keyPorts: [],
      borders: [],
    },
  },

  // ══ L6 — BOGOTÁ · YOPAL ═══════════════════════════════════
  // Llanos Orientales. Saca producción agropecuaria del Casanare
  // y conecta con la frontera oriental por Villavicencio.
  {
    id: 'L6',
    code: 'CL-6',
    name: 'Bogotá – Yopal',
    shortName: 'Bog–Yopal',
    description: 'Llanos Orientales (Casanare)',
    nature: 'Agropecuario · Petrolero',
    origin: 'Bogotá',
    destination: 'Yopal',
    totalKm: 365,
    totalDistanceKm: 365,
    color: CORRIDOR_COLORS.C5,
    legacyCorridorIds: ['C5'],
    waypoints: [
      { name: 'Bogotá',         lat: 4.7110, lng: -74.0721 },
      { name: 'Villavicencio',  lat: 4.1420, lng: -73.6266 },
      { name: 'Cumaral',        lat: 4.2740, lng: -73.4845 },
      { name: 'Aguazul',        lat: 5.1729, lng: -72.5466 },
      { name: 'Yopal',          lat: 5.3378, lng: -72.3958 },
    ],
    nodes: [
      { id: 'L6-N01', name: 'Bogotá',        lat: 4.7110, lng: -74.0721, kind: 'origin'  },
      { id: 'L6-N02', name: 'Villavicencio', lat: 4.1420, lng: -73.6266, kind: 'transit' },
      { id: 'L6-N03', name: 'Cumaral',       lat: 4.2740, lng: -73.4845, kind: 'transit' },
      { id: 'L6-N04', name: 'Aguazul',       lat: 5.1729, lng: -72.5466, kind: 'transit' },
      { id: 'L6-N05', name: 'Yopal',         lat: 5.3378, lng: -72.3958, kind: 'transit' },
    ],
    segments: [
      {
        id: 'L6-S01', fromNodeId: 'L6-N01', toNodeId: 'L6-N02',
        label: 'Bogotá – Villavicencio', distanceKm: 85, speedLimit: 60,
        polyline: [[4.7110, -74.0721], [4.2851, -73.8348], [4.2011, -73.7214], [4.1420, -73.6266]],
        tollRefs: ['C5-01', 'C5-02'],
        departments: ['Cundinamarca', 'Meta'],
      },
      {
        id: 'L6-S02', fromNodeId: 'L6-N02', toNodeId: 'L6-N03',
        label: 'Villavicencio – Cumaral', distanceKm: 50, speedLimit: 60,
        polyline: [[4.1420, -73.6266], [4.0262, -73.7751], [4.0568, -73.4632], [4.2740, -73.4845]],
        tollRefs: ['C5-03', 'C5-04'],
        departments: ['Meta'],
      },
      {
        id: 'L6-S03', fromNodeId: 'L6-N03', toNodeId: 'L6-N04',
        label: 'Cumaral – Aguazul', distanceKm: 180, speedLimit: 60,
        polyline: [[4.2740, -73.4845], [4.6000, -73.0000], [5.1729, -72.5466]],
        tollRefs: [],
        departments: ['Meta', 'Casanare'],
      },
      {
        id: 'L6-S04', fromNodeId: 'L6-N04', toNodeId: 'L6-N05',
        label: 'Aguazul – Yopal', distanceKm: 50, speedLimit: 80,
        polyline: [[5.1729, -72.5466], [5.2500, -72.4700], [5.3378, -72.3958]],
        tollRefs: [],
        departments: ['Casanare'],
      },
    ],
    tollRefs: ['C5-01', 'C5-02', 'C5-03', 'C5-04'],
    tolls: [
      { id: 'C5-01', name: 'NARANJAL',    sector: 'BOGOTÁ - VILLAVICENCIO',             km: 'KM 38'  },
      { id: 'C5-02', name: 'PIPIRAL',     sector: 'BOGOTÁ (EL PORTAL) - VILLAVICENCIO', km: 'KM 68'  },
      { id: 'C5-03', name: 'OCOA',        sector: 'PUENTE SOBRE RÍO OCOA',              km: 'KM 88'  },
      { id: 'C5-04', name: 'LA LIBERTAD', sector: 'VILLAVICENCIO - PUENTE LA BALSA',    km: 'KM 108' },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['agropecuario', 'petrolero', 'llanos'],
      keyPorts: [],
      borders: [],
    },
  },

  // ══ L7 — BOGOTÁ · PUERTO ASÍS ═════════════════════════════
  // Frontera Sur. Conecta el interior con el Putumayo y la
  // frontera con Ecuador vía la Marginal de la Selva.
  {
    id: 'L7',
    code: 'CL-7',
    name: 'Bogotá – Puerto Asís',
    shortName: 'Bog–Pto Asís',
    description: 'Frontera Sur (Marginal de la Selva)',
    nature: 'Frontera · Comercio binacional',
    origin: 'Bogotá',
    destination: 'Puerto Asís',
    totalKm: 725,
    totalDistanceKm: 725,
    color: CORRIDOR_COLORS.C2,
    legacyCorridorIds: ['C3'],
    waypoints: [
      { name: 'Bogotá',      lat: 4.7110, lng: -74.0721 },
      { name: 'Girardot',    lat: 4.3030, lng: -74.8060 },
      { name: 'Neiva',       lat: 2.9273, lng: -75.2819 },
      { name: 'Pitalito',    lat: 1.8400, lng: -76.0500 },
      { name: 'Mocoa',       lat: 1.1500, lng: -76.6500 },
      { name: 'Puerto Asís', lat: 0.5083, lng: -76.4994 },
    ],
    nodes: [
      { id: 'L7-N01', name: 'Bogotá',      lat: 4.7110, lng: -74.0721, kind: 'origin'  },
      { id: 'L7-N02', name: 'Girardot',    lat: 4.3030, lng: -74.8060, kind: 'transit' },
      { id: 'L7-N03', name: 'Neiva',       lat: 2.9273, lng: -75.2819, kind: 'transit' },
      { id: 'L7-N04', name: 'Pitalito',    lat: 1.8400, lng: -76.0500, kind: 'transit' },
      { id: 'L7-N05', name: 'Mocoa',       lat: 1.1500, lng: -76.6500, kind: 'transit' },
      { id: 'L7-N06', name: 'Puerto Asís', lat: 0.5083, lng: -76.4994, kind: 'border'  },
    ],
    segments: [
      {
        id: 'L7-S01', fromNodeId: 'L7-N01', toNodeId: 'L7-N02',
        label: 'Bogotá – Girardot', distanceKm: 135, speedLimit: 80,
        polyline: [[4.7110, -74.0721], [4.5370, -74.2721], [4.3030, -74.8060]],
        tollRefs: ['C3-01', 'C3-02', 'C3-03'],
        departments: ['Cundinamarca'],
      },
      {
        id: 'L7-S02', fromNodeId: 'L7-N02', toNodeId: 'L7-N03',
        label: 'Girardot – Neiva', distanceKm: 175, speedLimit: 80,
        polyline: [[4.3030, -74.8060], [4.1920, -74.8610], [3.5000, -75.0000], [2.9273, -75.2819]],
        tollRefs: ['C3-04'],
        departments: ['Cundinamarca', 'Tolima', 'Huila'],
      },
      {
        id: 'L7-S03', fromNodeId: 'L7-N03', toNodeId: 'L7-N04',
        label: 'Neiva – Pitalito', distanceKm: 185, speedLimit: 80,
        polyline: [[2.9273, -75.2819], [2.3000, -75.6000], [1.8400, -76.0500]],
        tollRefs: [],
        departments: ['Huila'],
      },
      {
        id: 'L7-S04', fromNodeId: 'L7-N04', toNodeId: 'L7-N05',
        label: 'Pitalito – Mocoa', distanceKm: 135, speedLimit: 60,
        polyline: [[1.8400, -76.0500], [1.5000, -76.3500], [1.1500, -76.6500]],
        tollRefs: [],
        departments: ['Huila', 'Putumayo'],
      },
      {
        id: 'L7-S05', fromNodeId: 'L7-N05', toNodeId: 'L7-N06',
        label: 'Mocoa – Puerto Asís', distanceKm: 95, speedLimit: 60,
        polyline: [[1.1500, -76.6500], [0.8000, -76.5500], [0.5083, -76.4994]],
        tollRefs: [],
        departments: ['Putumayo'],
      },
    ],
    tollRefs: ['C3-01', 'C3-02', 'C3-03', 'C3-04'],
    tolls: [
      { id: 'C3-01', name: 'CHUSACÁ',  sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', km: 'KM 14'  },
      { id: 'C3-02', name: 'CHINAUTA', sector: 'GIRARDOT - SILVANIA - BOGOTÁ (BOSA)', km: 'KM 68'  },
      { id: 'C3-03', name: 'PUBENZA',  sector: 'GIRARDOT - TOCAIMA',                  km: 'KM 100' },
      { id: 'C3-04', name: 'FLANDES',  sector: 'EL ESPINAL - GIRARDOT',               km: 'KM 130' },
    ],
    strategic: {
      resolution: '20223040002435/2022',
      chamber: 'Mintransporte',
      role: ['frontera_sur', 'comercio_binacional', 'marginal_selva'],
      keyPorts: [],
      borders: ['Puerto Asís–San Miguel'],
    },
  },
];

// ─── Helpers de lookup ──────────────────────────────────────

// Busca un corredor logístico por id ('L1'..'L7'). Tolera lowercase.
export const getLogisticsCorridorById = (id) => {
  if (!id) return null;
  const key = String(id).toUpperCase();
  return LOGISTICS_CORRIDORS.find((c) => c.id === key) || null;
};

// Devuelve los corredores logísticos que contienen al corredor
// NEXUS dado ('C1'..'C7'). Útil para navegación cruzada.
export const getLogisticsCorridorByLegacyId = (cId) => {
  if (!cId) return [];
  const key = String(cId).toUpperCase();
  return LOGISTICS_CORRIDORS.filter((c) => c.legacyCorridorIds.includes(key));
};

// Totales agregados (para tarjetas KPI del index).
export const TOTAL_LOGISTICS_CORRIDORS = LOGISTICS_CORRIDORS.length;

export const TOTAL_LOGISTICS_KM = LOGISTICS_CORRIDORS.reduce(
  (acc, c) => acc + (c.totalDistanceKm || 0),
  0,
);

// Conjunto único de tollRefs monitorizados en TODO el sistema logístico.
export const ALL_LOGISTICS_TOLL_REFS = Array.from(
  new Set(LOGISTICS_CORRIDORS.flatMap((c) => c.tollRefs)),
);
